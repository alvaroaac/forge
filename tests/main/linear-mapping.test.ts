import { describe, it, expect } from 'vitest';
import { isBug, mapPriority, mapStatus } from '../../src/main/services/linear-mapping';

describe('mapPriority', () => {
  it('maps Linear numeric priorities', () => {
    expect(mapPriority(1)).toBe('urgent');
    expect(mapPriority(2)).toBe('high');
    expect(mapPriority(3)).toBe('medium');
    expect(mapPriority(4)).toBe('low');
    expect(mapPriority(0)).toBe('none');
  });
  it('falls back to none for unexpected', () => {
    expect(mapPriority(99)).toBe('none');
  });
});

describe('isBug', () => {
  it('matches "bug" label case-insensitively', () => {
    expect(isBug({ labels: ['Bug'], issueType: null })).toBe(true);
    expect(isBug({ labels: ['BUG'], issueType: null })).toBe(true);
    expect(isBug({ labels: ['bug'], issueType: null })).toBe(true);
  });
  it('matches issueType.name when label missing', () => {
    expect(isBug({ labels: ['feature'], issueType: { name: 'Bug' } })).toBe(true);
  });
  it('returns false otherwise', () => {
    expect(isBug({ labels: ['feature'], issueType: null })).toBe(false);
    expect(isBug({ labels: [], issueType: null })).toBe(false);
  });
});

describe('mapStatus', () => {
  it('maps Linear state.type to internal IssueStatus', () => {
    expect(mapStatus({ name: 'Todo', type: 'unstarted' })).toBe('todo');
    expect(mapStatus({ name: 'Backlog', type: 'backlog' })).toBe('todo');
    expect(mapStatus({ name: 'Triage', type: 'triage' })).toBe('triage');
    expect(mapStatus({ name: 'In Progress', type: 'started' })).toBe('in_progress');
    expect(mapStatus({ name: 'In Review', type: 'review' })).toBe('in_review');
    expect(mapStatus({ name: 'Done', type: 'completed' })).toBe('done');
    expect(mapStatus({ name: 'Canceled', type: 'canceled' })).toBe('done');
  });
  it('falls back to todo for unknown type', () => {
    expect(mapStatus({ name: 'Whatever', type: 'unknown' })).toBe('todo');
  });
});
