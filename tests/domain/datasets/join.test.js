import { describe, expect, it } from 'vitest';
import { joinDatasets } from '../../../src/domain/datasets/join.js';

describe('joinDatasets', () => {
  it('executes join with multiple keys and prefixes conflicting columns', () => {
    const leftRows = [
      { id: 'A1', region: 'North', amount: 10, owner: 'Ana' },
      { id: 'B2', region: 'South', amount: 7, owner: 'Beto' },
    ];
    const rightRows = [
      { key: 'a1', area: 'north', amount: 100, status: 'ok' },
      { key: 'C3', area: 'West', amount: 80, status: 'late' },
    ];

    const result = joinDatasets({
      leftRows,
      rightRows,
      leftKeys: ['id', 'region'],
      rightKeys: ['key', 'area'],
      joinType: 'inner',
      leftColumns: ['id', 'amount'],
      rightColumns: ['amount', 'status'],
      leftDatasetName: 'sales.csv',
      rightDatasetName: 'targets.csv',
      normalization: { trim: true, caseSensitive: false },
    });

    expect(result.rows.length).toBe(1);
    expect(result.rows[0]).toEqual({
      id: 'A1',
      'sales.amount': 10,
      'targets.amount': 100,
      status: 'ok',
    });
  });

  it('supports full join with non-matching rows', () => {
    const result = joinDatasets({
      leftRows: [{ id: '1', value: 'L1' }],
      rightRows: [{ id: '2', value: 'R2' }],
      leftKeys: ['id'],
      rightKeys: ['id'],
      joinType: 'full',
      leftColumns: ['id', 'value'],
      rightColumns: ['id', 'value'],
      leftDatasetName: 'left.csv',
      rightDatasetName: 'right.csv',
    });

    expect(result.rows.length).toBe(2);
    expect(result.outputColumns).toContain('left.id');
    expect(result.outputColumns).toContain('right.id');
  });

  describe('joinDatasets input validation', () => {
    it('fails when datasets are not arrays', () => {
      const r = joinDatasets({
        leftRows: 'not array',
        rightRows: [],
        leftKeys: ['id'],
        rightKeys: ['id'],
        leftDatasetName: 'a.csv',
        rightDatasetName: 'b.csv',
      });
      expect(r.ok).toBe(false);
      expect(r.reason).toBe('join-invalid-datasets');
    });

    it('fails when keys are missing or empty', () => {
      const empty = joinDatasets({
        leftRows: [],
        rightRows: [],
        leftKeys: [],
        rightKeys: ['id'],
        leftDatasetName: 'a.csv',
        rightDatasetName: 'b.csv',
      });
      expect(empty.ok).toBe(false);
      expect(empty.reason).toBe('join-keys-required');

      const nullKeys = joinDatasets({
        leftRows: [],
        rightRows: [],
        leftKeys: null,
        rightKeys: ['id'],
        leftDatasetName: 'a.csv',
        rightDatasetName: 'b.csv',
      });
      expect(nullKeys.ok).toBe(false);
      expect(nullKeys.reason).toBe('join-keys-required');
    });

    it('fails when key counts do not match', () => {
      const r = joinDatasets({
        leftRows: [],
        rightRows: [],
        leftKeys: ['id', 'name'],
        rightKeys: ['key'],
        leftDatasetName: 'a.csv',
        rightDatasetName: 'b.csv',
      });
      expect(r.ok).toBe(false);
      expect(r.reason).toBe('join-keys-mismatch');
    });

    it('supports left join with non-matching rows', () => {
      const result = joinDatasets({
        leftRows: [{ id: '1', val: 'A' }, { id: '2', val: 'B' }],
        rightRows: [{ id: '1', score: '10' }],
        leftKeys: ['id'],
        rightKeys: ['id'],
        joinType: 'left',
        leftColumns: ['id', 'val'],
        rightColumns: ['score'],
        leftDatasetName: 'left.csv',
        rightDatasetName: 'right.csv',
      });
      expect(result.ok).toBe(true);
      expect(result.rows.length).toBe(2);
      expect(result.rows[1].score).toBeNull();
    });

    it('supports right join with non-matching rows', () => {
      const result = joinDatasets({
        leftRows: [{ id: '1', val: 'A' }],
        rightRows: [{ id: '1', score: '10' }, { id: '2', score: '20' }],
        leftKeys: ['id'],
        rightKeys: ['id'],
        joinType: 'right',
        leftColumns: ['val'],
        rightColumns: ['id', 'score'],
        leftDatasetName: 'left.csv',
        rightDatasetName: 'right.csv',
      });
      expect(result.rows.length).toBe(2);
      expect(result.rows[1].val).toBeNull();
    });

    it('falls back to inner join when type is invalid', () => {
      const result = joinDatasets({
        leftRows: [{ id: '1' }],
        rightRows: [{ id: '2' }],
        leftKeys: ['id'],
        rightKeys: ['id'],
        joinType: 'invalid',
        leftColumns: ['id'],
        rightColumns: ['id'],
        leftDatasetName: 'a.csv',
        rightDatasetName: 'b.csv',
      });
      expect(result.rows.length).toBe(0);
    });

    it('resolves name collision with numeric suffix', () => {
      const result = joinDatasets({
        leftRows: [{ id: '1', value: 'L', value2: 'extra' }],
        rightRows: [{ id: '1', value: 'R', value2: 'extra2' }],
        leftKeys: ['id'],
        rightKeys: ['id'],
        joinType: 'inner',
        leftColumns: ['value', 'value2'],
        rightColumns: ['value', 'value2'],
        leftDatasetName: 'a.csv',
        rightDatasetName: 'b.csv',
      });
      expect(result.rows.length).toBe(1);
      expect(result.outputColumns).toContain('a.value');
      expect(result.outputColumns).toContain('b.value');
      expect(result.outputColumns).toContain('a.value2');
      expect(result.outputColumns).toContain('b.value2');
    });

    it('sanitizes file-name prefix with special characters', () => {
      const result = joinDatasets({
        leftRows: [{ id: '1', val: 'A' }],
        rightRows: [{ id: '1', val: 'B' }],
        leftKeys: ['id'],
        rightKeys: ['id'],
        joinType: 'inner',
        leftColumns: ['val'],
        rightColumns: ['val'],
        leftDatasetName: 'my file (2).csv',
        rightDatasetName: '',
      });
      expect(result.rows.length).toBe(1);
      expect(result.outputColumns).toContain('my-file-2.val');
      expect(result.outputColumns).toContain('right.val');
    });
  });
});
