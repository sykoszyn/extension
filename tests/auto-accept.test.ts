// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { findAcceptButton, safeClick } from '@ext/content/auto-accept';

beforeEach(() => {
  document.body.innerHTML = '';
});

describe('match-found detection', () => {
  it('finds the accept button inside a match-found dialog', () => {
    document.body.innerHTML = `<div role="dialog"><h2>Match found!</h2><button>Decline</button><button> Accept </button></div>`;
    expect(findAcceptButton(document)?.textContent?.trim()).toBe('Accept');
  });
  it('works for Spanish UI', () => {
    document.body.innerHTML = `<div class="Modal__Wrapper"><p>¡Partida encontrada!</p><button>Aceptar</button></div>`;
    expect(findAcceptButton(document)).not.toBeNull();
  });
  it('ignores party invites', () => {
    document.body.innerHTML = `<div role="dialog"><p>Match ready? Sykos invited you to a party</p><button>Accept</button></div>`;
    expect(findAcceptButton(document)).toBeNull();
  });
  it('ignores accept buttons outside dialogs and with extra text', () => {
    document.body.innerHTML = `<p>Match found</p><button>Accept</button><div role="dialog">Match found<button>Accept cookies</button></div>`;
    expect(findAcceptButton(document)).toBeNull();
  });
  it('ignores hidden/disabled buttons', () => {
    document.body.innerHTML = `<div role="dialog">Match found<button disabled>Accept</button><button style="display:none">Accept</button></div>`;
    expect(findAcceptButton(document)).toBeNull();
  });
  it('safeClick clicks only the same still-valid button', () => {
    document.body.innerHTML = `<div role="dialog">Your match is ready<button id="a">Accept</button></div>`;
    const btn = findAcceptButton(document)!;
    const spy = vi.fn();
    btn.addEventListener('click', spy);
    expect(safeClick(document, btn)).toBe(true);
    expect(spy).toHaveBeenCalledTimes(1);
    document.body.innerHTML = '';
    expect(safeClick(document, btn)).toBe(false);
  });
});
