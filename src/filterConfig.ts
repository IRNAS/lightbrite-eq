// Filter types
export type FilterType = 'peaking' | 'lowshelf' | 'highshelf' | 'lowpass' | 'highpass';

export interface FilterConfig {
  type: FilterType;
  freq: number;
  gain: number;
  Q?: number;
}

export const filters: FilterConfig[] = [
  {
    type: 'peaking', // pk12
    freq: 170,
    gain: 9.9,
    Q: 1.76
  },
  {
    type: 'peaking', // pk12
    freq: 662,
    gain: -8.0,
    Q: 3.0
  },
  {
    type: 'peaking', // pk12
    freq: 3000,
    gain: -11.2,
    Q: 2.76
  },
  {
    type: 'highshelf', // hs12
    freq: 7410,
    gain: 10
  }
];