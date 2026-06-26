export interface AISummaryConfig {
  enabled: boolean;
  maxBullets: 3 | 5 | 7;
  extractMethod: 'sentences' | 'headings' | 'hybrid';
  showLabel: boolean;
  labelText: string;
  position: 'top' | 'bottom';
}

export interface SummaryPoint {
  text: string;
  type: 'sentence' | 'heading';
}
