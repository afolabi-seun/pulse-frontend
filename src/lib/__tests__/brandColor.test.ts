import { describe, it, expect } from 'vitest';
import { applyBrandColor, hexToHslTriplet, isHexColor, readableForeground } from '../brandColor';

describe('brandColor', () => {
  it('accepts only # and six hex digits', () => {
    expect(isHexColor('#B8893B')).toBe(true);
    expect(isHexColor('#b8893b')).toBe(true);
    expect(isHexColor('#12345')).toBe(false);
    expect(isHexColor('red')).toBe(false);
    expect(isHexColor('#B8893B;background:url(//evil)')).toBe(false);
    expect(isHexColor(null)).toBe(false);
  });

  it('converts a hex colour to the theme\'s "H S% L%" form', () => {
    expect(hexToHslTriplet('#FF0000')).toBe('0 100% 50%');
    expect(hexToHslTriplet('#2563EB')).toBe('221 83% 53%');
    expect(hexToHslTriplet('#808080')).toBe('0 0% 50%');
    expect(hexToHslTriplet('#FFFFFF')).toBe('0 0% 100%');
  });

  it('puts dark text on a light colour and white text on a dark one', () => {
    expect(readableForeground('#FDE047')).toBe('250 24% 8%');
    expect(readableForeground('#1E3A8A')).toBe('0 0% 100%');
  });

  it('sets the accent variables on the element, and clears them again', () => {
    const el = document.createElement('div');

    applyBrandColor('#2563EB', el);
    expect(el.style.getPropertyValue('--primary')).toBe('221 83% 53%');
    expect(el.style.getPropertyValue('--ring')).toBe('221 83% 53%');
    expect(el.style.getPropertyValue('--primary-foreground')).toBe('0 0% 100%');

    applyBrandColor(null, el);
    expect(el.style.getPropertyValue('--primary')).toBe('');
    expect(el.style.getPropertyValue('--primary-foreground')).toBe('');
  });

  it('leaves the theme alone for anything that is not a hex colour', () => {
    const el = document.createElement('div');
    applyBrandColor('#2563EB', el);

    applyBrandColor('red; --primary: 0 0% 0%', el);

    expect(el.style.getPropertyValue('--primary')).toBe('');
  });
});
