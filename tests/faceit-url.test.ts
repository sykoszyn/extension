import { describe, expect, it } from 'vitest';
import { parseFaceitPath, parseSearchInput } from '@shared/utils/faceit-url';

const MID = '1-0a1b2c3d-1111-4222-8333-444455556666';

describe('FACEIT URL routing', () => {
  it('profiles in any language and sub-tab', () => {
    expect(parseFaceitPath('/es/players/Sykos')).toEqual({ kind: 'profile', nickname: 'Sykos' });
    expect(parseFaceitPath('/en/players/Sykos/stats/cs2')).toEqual({ kind: 'profile', nickname: 'Sykos' });
    expect(parseFaceitPath('/pt-br/players/a.b-c_d')).toEqual({ kind: 'profile', nickname: 'a.b-c_d' });
  });
  it('match rooms', () => {
    expect(parseFaceitPath(`/es/cs2/room/${MID}`)).toEqual({ kind: 'room', matchId: MID });
    expect(parseFaceitPath(`/en/cs2/room/${MID}/scoreboard`)).toEqual({ kind: 'room', matchId: MID });
    expect(parseFaceitPath('/en/cs2/room/not-an-id').kind).toBe('other');
    expect(parseFaceitPath('/en/home').kind).toBe('other');
  });
  it('search input', () => {
    expect(parseSearchInput('Sykos')).toEqual({ kind: 'nickname', value: 'Sykos' });
    expect(parseSearchInput('https://www.faceit.com/es/players/Sykos')).toEqual({ kind: 'nickname', value: 'Sykos' });
    expect(parseSearchInput(`faceit.com/en/cs2/room/${MID}`)).toEqual({ kind: 'match', value: MID });
    expect(parseSearchInput(MID)).toEqual({ kind: 'match', value: MID });
    expect(parseSearchInput('a').kind).toBe('invalid');
    expect(parseSearchInput('https://evil.com/players/x').kind).toBe('invalid');
  });
});
