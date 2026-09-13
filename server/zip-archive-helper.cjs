const fs = require('fs');
const path = require('path');
const { unzipSync, zipSync } = require('fflate');

const CENTRAL_DIRECTORY_SIGNATURE = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = 0x06054b50;
const LOCAL_FILE_HEADER_SIGNATURE = 0x04034b50;
const MAX_ZIP_COMMENT_BYTES = 0xffff;

const crcTable = new Uint32Array(256);
for (let index = 0; index < crcTable.length; index += 1) {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  crcTable[index] = value >>> 0;
}

function crc32(data) {
  let value = 0xffffffff;
  for (const byte of data) {
    value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function assertReadableRange(buffer, offset, length, label) {
  if (
    !Number.isSafeInteger(offset) ||
    !Number.isSafeInteger(length) ||
    offset < 0 ||
    length < 0 ||
    offset + length > buffer.length
  ) {
    throw new Error(`Invalid ZIP ${label}`);
  }
}

function findEndOfCentralDirectory(buffer) {
  const minimumOffset = Math.max(0, buffer.length - 22 - MAX_ZIP_COMMENT_BYTES);
  for (let offset = buffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
      return offset;
    }
  }
  throw new Error('ZIP central directory is missing');
}

function decodeEntryName(nameBytes, flags) {
  const usesUtf8 = (flags & 0x0800) !== 0;
  if (!usesUtf8 && nameBytes.some((byte) => byte > 0x7f)) {
    throw new Error('ZIP entry name must use UTF-8');
  }

  const name = nameBytes.toString('utf8');
  if (name.includes('\ufffd')) {
    throw new Error('ZIP entry name is not valid UTF-8');
  }
  return name;
}

function parseZipArchive(source) {
  const buffer = Buffer.isBuffer(source) ? source : fs.readFileSync(source);
  if (buffer.length < 22) throw new Error('ZIP archive is too small');

  const endOffset = findEndOfCentralDirectory(buffer);
  assertReadableRange(buffer, endOffset, 22, 'end record');

  const diskNumber = buffer.readUInt16LE(endOffset + 4);
  const centralDirectoryDisk = buffer.readUInt16LE(endOffset + 6);
  const entriesOnDisk = buffer.readUInt16LE(endOffset + 8);
  const entryCount = buffer.readUInt16LE(endOffset + 10);
  const centralDirectorySize = buffer.readUInt32LE(endOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(endOffset + 16);
  const commentLength = buffer.readUInt16LE(endOffset + 20);

  if (endOffset + 22 + commentLength !== buffer.length) {
    throw new Error('ZIP archive has trailing or truncated data');
  }
  if (diskNumber !== 0 || centralDirectoryDisk !== 0 || entriesOnDisk !== entryCount) {
    throw new Error('Multi-disk ZIP archives are not supported');
  }
  if (
    entryCount === 0xffff ||
    centralDirectorySize === 0xffffffff ||
    centralDirectoryOffset === 0xffffffff
  ) {
    throw new Error('ZIP64 archives are not supported');
  }
  assertReadableRange(buffer, centralDirectoryOffset, centralDirectorySize, 'central directory');
  if (centralDirectoryOffset + centralDirectorySize !== endOffset) {
    throw new Error('ZIP central directory boundary is invalid');
  }

  const entries = [];
  let cursor = centralDirectoryOffset;
  for (let index = 0; index < entryCount; index += 1) {
    assertReadableRange(buffer, cursor, 46, 'central entry');
    if (buffer.readUInt32LE(cursor) !== CENTRAL_DIRECTORY_SIGNATURE) {
      throw new Error('ZIP central entry signature is invalid');
    }

    const versionMadeBy = buffer.readUInt16LE(cursor + 4);
    const flags = buffer.readUInt16LE(cursor + 8);
    const compressionMethod = buffer.readUInt16LE(cursor + 10);
    const checksum = buffer.readUInt32LE(cursor + 16);
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const uncompressedSize = buffer.readUInt32LE(cursor + 24);
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const entryCommentLength = buffer.readUInt16LE(cursor + 32);
    const diskStart = buffer.readUInt16LE(cursor + 34);
    const externalAttributes = buffer.readUInt32LE(cursor + 38);
    const localHeaderOffset = buffer.readUInt32LE(cursor + 42);
    const recordLength = 46 + nameLength + extraLength + entryCommentLength;

    assertReadableRange(buffer, cursor, recordLength, 'central entry fields');
    if (
      compressedSize === 0xffffffff ||
      uncompressedSize === 0xffffffff ||
      localHeaderOffset === 0xffffffff
    ) {
      throw new Error('ZIP64 entries are not supported');
    }
    if (diskStart !== 0) throw new Error('Multi-disk ZIP entries are not supported');

    const nameBytes = buffer.subarray(cursor + 46, cursor + 46 + nameLength);
    const name = decodeEntryName(nameBytes, flags);
    assertReadableRange(buffer, localHeaderOffset, 30, 'local entry');
    if (buffer.readUInt32LE(localHeaderOffset) !== LOCAL_FILE_HEADER_SIGNATURE) {
      throw new Error('ZIP local entry signature is invalid');
    }

    const localFlags = buffer.readUInt16LE(localHeaderOffset + 6);
    const localMethod = buffer.readUInt16LE(localHeaderOffset + 8);
    const localChecksum = buffer.readUInt32LE(localHeaderOffset + 14);
    const localCompressedSize = buffer.readUInt32LE(localHeaderOffset + 18);
    const localUncompressedSize = buffer.readUInt32LE(localHeaderOffset + 22);
    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const localRecordLength = 30 + localNameLength + localExtraLength;
    assertReadableRange(buffer, localHeaderOffset, localRecordLength, 'local entry fields');

    const localNameBytes = buffer.subarray(
      localHeaderOffset + 30,
      localHeaderOffset + 30 + localNameLength
    );
    if (
      !nameBytes.equals(localNameBytes) ||
      localFlags !== flags ||
      localMethod !== compressionMethod
    ) {
      throw new Error('ZIP central and local entry metadata do not match');
    }
    if (
      (flags & 0x0008) === 0 &&
      (localChecksum !== checksum ||
        localCompressedSize !== compressedSize ||
        localUncompressedSize !== uncompressedSize)
    ) {
      throw new Error('ZIP central and local entry sizes do not match');
    }

    const dataOffset = localHeaderOffset + localRecordLength;
    assertReadableRange(buffer, dataOffset, compressedSize, 'entry data');
    if (dataOffset + compressedSize > centralDirectoryOffset) {
      throw new Error('ZIP entry data overlaps its central directory');
    }

    const unixMode = (externalAttributes >>> 16) & 0xffff;
    entries.push({
      name,
      flags,
      compressionMethod,
      checksum,
      compressedSize,
      uncompressedSize,
      externalAttributes,
      isDirectory:
        name.endsWith('/') || (externalAttributes & 0x10) !== 0 || (unixMode & 0xf000) === 0x4000,
      isSymbolicLink: versionMadeBy >>> 8 === 3 && (unixMode & 0xf000) === 0xa000,
      dataOffset,
      localHeaderOffset,
    });
    cursor += recordLength;
  }

  if (cursor !== endOffset) throw new Error('ZIP central directory length is inconsistent');
  return { buffer, entries };
}

function inflateZipArchive(parsedArchive, selectedEntries = parsedArchive.entries) {
  const selectedByName = new Map(selectedEntries.map((entry) => [entry.name, entry]));
  const inflated = unzipSync(parsedArchive.buffer, {
    filter(info) {
      const entry = selectedByName.get(info.name);
      if (!entry || entry.isDirectory) return false;
      if (
        info.compression !== entry.compressionMethod ||
        info.size !== entry.compressedSize ||
        info.originalSize !== entry.uncompressedSize
      ) {
        throw new Error('ZIP entry metadata changed during decompression');
      }
      return true;
    },
  });

  const result = new Map();
  for (const entry of selectedEntries) {
    if (entry.isDirectory) continue;
    if (!Object.prototype.hasOwnProperty.call(inflated, entry.name)) {
      throw new Error('ZIP entry could not be decompressed');
    }
    const data = Buffer.from(inflated[entry.name]);
    if (data.length !== entry.uncompressedSize || crc32(data) !== entry.checksum) {
      throw new Error('ZIP entry size or checksum is invalid');
    }
    result.set(entry.name, data);
  }
  return result;
}

function normalizeArchivePath(archivePath) {
  const normalized = String(archivePath || '')
    .split(path.sep)
    .join('/');
  if (!normalized || normalized.startsWith('/') || normalized.includes('\\')) {
    throw new Error('Invalid release ZIP entry path');
  }
  return normalized;
}

function createZipFile(outputPath, fileEntries) {
  const input = Object.create(null);
  const seen = new Set();
  for (const fileEntry of fileEntries) {
    const archivePath = normalizeArchivePath(fileEntry.archivePath);
    if (seen.has(archivePath)) throw new Error(`Duplicate release ZIP entry: ${archivePath}`);
    seen.add(archivePath);

    const stats = fs.lstatSync(fileEntry.sourcePath);
    if (!stats.isFile() || stats.isSymbolicLink()) {
      throw new Error(`Release ZIP source is not a regular file: ${archivePath}`);
    }
    input[archivePath] = [fs.readFileSync(fileEntry.sourcePath), { mtime: stats.mtime }];
  }

  fs.writeFileSync(outputPath, Buffer.from(zipSync(input, { level: 6 })));
}

function listZipEntries(source) {
  return parseZipArchive(source).entries.map((entry) => entry.name);
}

module.exports = {
  createZipFile,
  inflateZipArchive,
  listZipEntries,
  parseZipArchive,
};
