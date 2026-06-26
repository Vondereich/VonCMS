import { useState, useEffect } from 'react';
import {
  Plus,
  Save,
  Trash,
  Copy,
  ChevronLeft,
  Mail,
  MessageSquare,
  Code,
  Info,
  Settings,
  Database,
  RefreshCw,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ContactForm } from '../../types';
import { API } from '../../config/site.config';
import { getAuthHeader } from '../../config/auth.config';
import { vonFetch } from '../../utils/api';

const generateId = () => Math.random().toString(36).substring(2, 9);

const DEFAULT_TEMPLATE = `<label> Your Name (required)
    [text* your-name] </label>

<label> Your Email (required)
    [email* your-email] </label>

<label> Subject
    [text your-subject] </label>

<label> Your Message
    [textarea your-message] </label>

[submit "Send Message"]`;

const DEFAULT_MAIL = {
  to: '[_site_email]',
  from: '[_site_email]',
  subject: 'New message from [your-name]',
  body: `From: [your-name] <[your-email]>
Subject: [your-subject]

Message Body:
[your-message]

--
This e-mail was sent from a contact form on VonCMS`,
};

const DEFAULT_MESSAGES = {
  success: 'Thank you for your message. It has been sent.',
  error: 'There was an error trying to send your message. Please try again later.',
  validationError: 'One or more fields have an error. Please check and try again.',
};

const ContactManager = () => {
  const [forms, setForms] = useState<ContactForm[]>([]);
  const [currentForm, setCurrentForm] = useState<ContactForm | null>(null);
  const [view, setView] = useState<'list' | 'edit'>('list');
  const [activeTab, setActiveTab] = useState<'form' | 'mail' | 'messages'>('form');
  const [loading, setLoading] = useState(false);

  const fetchForms = async () => {
    try {
      const res = await vonFetch(API.contactForms, {
        headers: getAuthHeader() ? { Authorization: getAuthHeader() } : {},
      });
      const data = await res.json();
      if (data.success) {
        setForms(data.forms);
      }
    } catch (err) {
      toast.error('Failed to load contact forms');
    }
  };

  useEffect(() => {
    fetchForms();
  }, []);

  const handleSave = async () => {
    if (!currentForm) return;
    setLoading(true);

    try {
      const res = await vonFetch(API.saveContactForm, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getAuthHeader() ? { Authorization: getAuthHeader() } : {}),
        },
        body: JSON.stringify(currentForm),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Contact form saved successfully');
        fetchForms();
      } else {
        toast.error(data.message || 'Failed to save');
      }
    } catch (err) {
      toast.error('Network error during save');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this contact form?')) return;

    try {
      const res = await vonFetch(API.deleteContactForm, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(getAuthHeader() ? { Authorization: getAuthHeader() } : {}),
        },
        body: JSON.stringify({ id }),
      });

      const data = await res.json();
      if (data.success) {
        toast.success('Contact form deleted');
        fetchForms();
        if (currentForm?.id === id) {
          setView('list');
          setCurrentForm(null);
        }
      }
    } catch (err) {
      toast.error('Failed to delete form');
    }
  };

  const handleMigrate = async () => {
    if (!window.confirm('Migrate existing forms from settings table to dedicated table?')) return;
    setLoading(true);
    try {
      const res = await vonFetch(API.migrateContactForms, {
        method: 'POST',
        headers: {
          ...(getAuthHeader() ? { Authorization: getAuthHeader() } : {}),
        },
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message);
        fetchForms();
      } else {
        toast.error(data.message);
      }
    } catch (err) {
      toast.error('Migration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    const newForm: ContactForm = {
      id: generateId(),
      title: 'Untitled Form',
      template: DEFAULT_TEMPLATE,
      mail: { ...DEFAULT_MAIL },
      messages: { ...DEFAULT_MESSAGES },
      createdAt: new Date().toISOString(),
    };
    setCurrentForm(newForm);
    setView('edit');
    setActiveTab('form');
  };

  const copyShortcode = (id: string) => {
    navigator.clipboard.writeText(`[von-contact id="${id}"]`);
    toast.success('Shortcode copied to clipboard');
  };

  if (view === 'list') {
    return (
      <div className="p-6 max-w-6xl mx-auto animate-fade-in">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Contact Forms</h1>
            <p className="text-gray-500 dark:text-gray-400">
              Manage your contact forms (Dedicated Table)
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleMigrate}
              disabled={loading}
              className="bg-slate-100 dark:bg-[#242633] hover:bg-slate-200 text-slate-700 dark:text-slate-200 px-4 py-2 rounded-lg flex items-center gap-2 transition-all border border-slate-200 dark:border-[#333544] dark:hover:bg-[#333544]"
              title="Migrate forms from old settings table"
            >
              <Database size={18} /> Migrate
            </button>
            <button
              onClick={handleCreate}
              className="bg-[#1a1b26] hover:bg-[#242633] text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-all shadow-lg shadow-slate-900/20 dark:bg-[#242633] dark:hover:bg-[#333544]"
            >
              <Plus size={18} /> Add New
            </button>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1a1b26] rounded-xl shadow-sm border border-gray-200 dark:border-[#2a2b36] overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-gray-50 dark:bg-[#16161e]/70 text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-[#2a2b36]">
              <tr>
                <th className="p-4 font-semibold">Title</th>
                <th className="p-4 font-semibold">Shortcode</th>
                <th className="p-4 font-semibold">Date</th>
                <th className="p-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-[#2a2b36]">
              {forms.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500">
                    No contact forms found. Create one to get started.
                  </td>
                </tr>
              ) : (
                forms.map((form) => (
                  <tr
                    key={form.id}
                    className="hover:bg-gray-50 dark:hover:bg-[#242633]/50 transition-colors"
                  >
                    <td
                      className="p-4 font-medium text-slate-800 hover:text-[#1a1b26] dark:text-slate-100 dark:hover:text-white cursor-pointer"
                      onClick={() => {
                        setCurrentForm(form);
                        setView('edit');
                      }}
                    >
                      {form.title}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 bg-gray-100 dark:bg-[#101018] px-3 py-1 rounded border border-gray-200 dark:border-[#2a2b36] w-fit text-sm font-mono text-gray-600 dark:text-gray-400">
                        {`[von-contact id="${form.id}"]`}
                        <button
                          onClick={() => copyShortcode(form.id)}
                          className="hover:text-[#1a1b26] dark:hover:text-white ml-2"
                          title="Copy"
                        >
                          <Copy size={14} />
                        </button>
                      </div>
                    </td>
                    <td className="p-4 text-gray-500 text-sm">
                      {new Date(form.createdAt).toLocaleDateString()}
                    </td>
                    <td className="p-4 text-right">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setCurrentForm(form);
                            setView('edit');
                          }}
                          className="p-2 text-gray-500 hover:text-[#1a1b26] hover:bg-slate-100 dark:hover:bg-[#242633] dark:hover:text-white rounded-lg transition-colors"
                        >
                          <Settings size={18} />
                        </button>
                        <button
                          onClick={() => handleDelete(form.id)}
                          className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        >
                          <Trash size={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // EDIT VIEW
  if (!currentForm) return null;

  return (
    <div className="p-6 max-w-6xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setView('list')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-[#242633] rounded-full transition-colors"
          >
            <ChevronLeft size={24} className="text-gray-600 dark:text-gray-300" />
          </button>
          <input
            aria-label="Contact form title"
            id="contactmanager-299"
            name="contactmanager299"
            type="text"
            value={currentForm.title}
            onChange={(e) => setCurrentForm({ ...currentForm, title: e.target.value })}
            className="text-2xl font-bold bg-transparent border-none focus:ring-0 text-gray-800 dark:text-white placeholder-gray-400 w-96 p-0"
            placeholder="Enter form title here"
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-2 bg-slate-100 dark:bg-[#16161e] px-4 py-2 rounded-lg text-sm text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#2a2b36]">
            <span className="font-mono selectable select-all">
              {`[von-contact id="${currentForm.id}"]`}
            </span>
            <button onClick={() => copyShortcode(currentForm.id)}>
              <Copy size={16} />
            </button>
          </div>
          <button
            onClick={handleSave}
            disabled={loading}
            className="bg-[#1a1b26] hover:bg-[#242633] text-white px-6 py-2 rounded-lg flex items-center gap-2 font-medium shadow-lg shadow-slate-900/20 transition-all disabled:opacity-50 dark:bg-[#242633] dark:hover:bg-[#333544]"
          >
            {loading ? <RefreshCw className="animate-spin" size={18} /> : <Save size={18} />}
            Save
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-[#1a1b26] rounded-xl shadow-sm border border-gray-200 dark:border-[#2a2b36] overflow-hidden min-h-[600px] flex flex-col">
        <div className="flex border-b border-gray-200 dark:border-[#2a2b36]">
          <button
            onClick={() => setActiveTab('form')}
            className={`px-6 py-4 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'form' ? 'border-[#1a1b26] text-[#1a1b26] dark:border-slate-100 dark:text-white' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-slate-200 border-b-transparent'}`}
          >
            <Code size={18} /> Form (Template)
          </button>
          <button
            onClick={() => setActiveTab('mail')}
            className={`px-6 py-4 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'mail' ? 'border-[#1a1b26] text-[#1a1b26] dark:border-slate-100 dark:text-white' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-slate-200 border-b-transparent'}`}
          >
            <Mail size={18} /> Mail
          </button>
          <button
            onClick={() => setActiveTab('messages')}
            className={`px-6 py-4 font-medium text-sm flex items-center gap-2 border-b-2 transition-colors ${activeTab === 'messages' ? 'border-[#1a1b26] text-[#1a1b26] dark:border-slate-100 dark:text-white' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-slate-200 border-b-transparent'}`}
          >
            <MessageSquare size={18} /> Messages
          </button>
        </div>

        <div className="p-6 flex-grow overflow-y-auto">
          {/* FORM TAB */}
          {activeTab === 'form' && (
            <div className="space-y-4 h-full flex flex-col">
              <div className="flex flex-wrap gap-2 mb-2">
                {['text', 'email', 'textarea', 'submit'].map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      const textarea = document.getElementById(
                        'form-template'
                      ) as HTMLTextAreaElement;
                      if (textarea) {
                        const start = textarea.selectionStart;
                        const end = textarea.selectionEnd;
                        const insert =
                          tag === 'submit'
                            ? '[submit "Send Message"]'
                            : `[${tag}* field-${Math.floor(Math.random() * 1000)}]`;
                        const newText =
                          currentForm.template.substring(0, start) +
                          insert +
                          currentForm.template.substring(end);
                        setCurrentForm({ ...currentForm, template: newText });
                      }
                    }}
                    className="bg-gray-100 dark:bg-[#242633] hover:bg-gray-200 px-3 py-1 rounded text-xs font-mono text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-[#333544] dark:hover:bg-[#333544]"
                  >
                    [{tag}]
                  </button>
                ))}
              </div>
              <textarea
                aria-label="Form Template"
                id="form-template"
                value={currentForm.template}
                onChange={(e) => setCurrentForm({ ...currentForm, template: e.target.value })}
                className="flex-grow w-full min-h-[400px] font-mono text-sm p-4 bg-gray-50 dark:bg-[#16161e] border border-gray-200 dark:border-[#2a2b36] rounded-lg focus:ring-2 focus:ring-slate-500/30 focus:border-[#1a1b26] dark:focus:border-slate-300 outline-none resize-none"
                placeholder="Edit your form template here using HTML and tags..."
              />
              <p className="text-xs text-gray-500">
                <Info size={12} className="inline mr-1" />
                Use HTML and Tags. Example: <code>[text* your-name]</code> for a required text
                field.
              </p>
            </div>
          )}

          {/* MAIL TAB */}
          {activeTab === 'mail' && (
            <div className="space-y-6 max-w-3xl">
              <div className="grid gap-6">
                <div>
                  <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    To
                  </span>
                  <div className="relative">
                    <input
                      aria-label="To"
                      id="contactmanager-403"
                      name="contactmanager403"
                      type="text"
                      value={currentForm.mail.to}
                      onChange={(e) =>
                        setCurrentForm({
                          ...currentForm,
                          mail: { ...currentForm.mail, to: e.target.value },
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-200 dark:border-[#2a2b36] rounded-lg bg-gray-50 dark:bg-[#16161e] focus:ring-2 focus:ring-slate-500/30 focus:border-[#1a1b26] dark:focus:border-slate-300 outline-none dark:text-white"
                    />
                    <button
                      onClick={() =>
                        setCurrentForm({
                          ...currentForm,
                          mail: { ...currentForm.mail, to: '[_site_email]' },
                        })
                      }
                      className="absolute right-2 top-1.5 px-2 py-1 bg-slate-200 dark:bg-[#242633] text-slate-700 dark:text-slate-200 text-xs rounded hover:bg-slate-300 dark:hover:bg-[#333544]"
                    >
                      Use Site Email
                    </button>
                  </div>
                  {currentForm.mail.to.includes('voncms.com') && (
                    <p className="text-xs text-orange-500 mt-1">
                      <Settings size={12} className="inline mr-1" />
                      Warning: Legacy email detected. Replace with <code>[_site_email]</code> for
                      dynamic configuration.
                    </p>
                  )}
                </div>
                <div>
                  <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    From
                  </span>
                  <div className="relative">
                    <input
                      id="contactmanager-439"
                      name="contactmanager439"
                      aria-label="From"
                      type="text"
                      value={currentForm.mail.from}
                      onChange={(e) =>
                        setCurrentForm({
                          ...currentForm,
                          mail: { ...currentForm.mail, from: e.target.value },
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-200 dark:border-[#2a2b36] rounded-lg bg-gray-50 dark:bg-[#16161e] focus:ring-2 focus:ring-slate-500/30 focus:border-[#1a1b26] dark:focus:border-slate-300 outline-none dark:text-white"
                    />
                    <button
                      onClick={() =>
                        setCurrentForm({
                          ...currentForm,
                          mail: { ...currentForm.mail, from: '[_site_email]' },
                        })
                      }
                      className="absolute right-2 top-1.5 px-2 py-1 bg-slate-200 dark:bg-[#242633] text-slate-700 dark:text-slate-200 text-xs rounded hover:bg-slate-300 dark:hover:bg-[#333544]"
                    >
                      Use Site Email
                    </button>
                  </div>
                  {currentForm.mail.from.includes('voncms.com') && (
                    <p className="text-xs text-orange-500 mt-1">
                      <Settings size={12} className="inline mr-1" />
                      Warning: Legacy email detected. Replace with <code>[_site_email]</code> for
                      dynamic configuration.
                    </p>
                  )}
                </div>
                <div>
                  <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Subject
                  </span>
                  <input
                    aria-label="Subject"
                    id="contactmanager-474"
                    name="contactmanager474"
                    type="text"
                    value={currentForm.mail.subject}
                    onChange={(e) =>
                      setCurrentForm({
                        ...currentForm,
                        mail: { ...currentForm.mail, subject: e.target.value },
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-200 dark:border-[#2a2b36] rounded-lg bg-gray-50 dark:bg-[#16161e] focus:ring-2 focus:ring-slate-500/30 focus:border-[#1a1b26] dark:focus:border-slate-300 outline-none dark:text-white"
                  />
                </div>
                <div>
                  <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Message Body
                  </span>
                  <textarea
                    id="contactmanager-490"
                    name="contactmanager490"
                    aria-label="Message Body"
                    rows={10}
                    value={currentForm.mail.body}
                    onChange={(e) =>
                      setCurrentForm({
                        ...currentForm,
                        mail: { ...currentForm.mail, body: e.target.value },
                      })
                    }
                    className="w-full px-4 py-2 border border-gray-200 dark:border-[#2a2b36] rounded-lg bg-gray-50 dark:bg-[#16161e] focus:ring-2 focus:ring-slate-500/30 focus:border-[#1a1b26] dark:focus:border-slate-300 outline-none font-mono text-sm dark:text-white"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Use tags like <code>[your-name]</code> to insert field values.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* MESSAGES TAB */}
          {activeTab === 'messages' && (
            <div className="space-y-6 max-w-3xl">
              <div>
                <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Sender's message was sent successfully
                </span>
                <input
                  aria-label="Sender's message was sent successfully"
                  id="contactmanager-516"
                  name="contactmanager516"
                  type="text"
                  value={currentForm.messages.success}
                  onChange={(e) =>
                    setCurrentForm({
                      ...currentForm,
                      messages: { ...currentForm.messages, success: e.target.value },
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-200 dark:border-[#2a2b36] rounded-lg bg-gray-50 dark:bg-[#16161e] focus:ring-2 focus:ring-slate-500/30 focus:border-[#1a1b26] dark:focus:border-slate-300 outline-none dark:text-white"
                />
              </div>
              <div>
                <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Sender's message failed to send
                </span>
                <input
                  id="contactmanager-532"
                  name="contactmanager532"
                  aria-label="Sender's message failed to send"
                  type="text"
                  value={currentForm.messages.error}
                  onChange={(e) =>
                    setCurrentForm({
                      ...currentForm,
                      messages: { ...currentForm.messages, error: e.target.value },
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-200 dark:border-[#2a2b36] rounded-lg bg-gray-50 dark:bg-[#16161e] focus:ring-2 focus:ring-slate-500/30 focus:border-[#1a1b26] dark:focus:border-slate-300 outline-none dark:text-white"
                />
              </div>
              <div>
                <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Validation errors occurred
                </span>
                <input
                  id="contactmanager-548"
                  name="contactmanager548"
                  aria-label="Validation errors occurred"
                  type="text"
                  value={currentForm.messages.validationError}
                  onChange={(e) =>
                    setCurrentForm({
                      ...currentForm,
                      messages: { ...currentForm.messages, validationError: e.target.value },
                    })
                  }
                  className="w-full px-4 py-2 border border-gray-200 dark:border-[#2a2b36] rounded-lg bg-gray-50 dark:bg-[#16161e] focus:ring-2 focus:ring-slate-500/30 focus:border-[#1a1b26] dark:focus:border-slate-300 outline-none dark:text-white"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContactManager;
