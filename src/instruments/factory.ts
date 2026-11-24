import type { InstrumentConfig } from '../model/types';
import type { Instrument } from './Instrument';
import { DrumMachine } from './DrumMachine';
import { SynthInstrument } from './SynthInstrument';
import { OrganInstrument } from './OrganInstrument';
import { SamplerInstrument } from './SamplerInstrument';

export function createInstrument(config: InstrumentConfig): Instrument {
  switch (config.type) {
    case 'drum-machine':
      return new DrumMachine(config);
    case 'synth':
      return new SynthInstrument(config);
    case 'organ':
      return new OrganInstrument(config);
    case 'sampler':
      return new SamplerInstrument(config);
  }
}
