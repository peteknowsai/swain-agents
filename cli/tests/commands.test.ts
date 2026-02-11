import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../lib/worker-client', () => ({
  workerRequest: vi.fn(),
  print: vi.fn(),
  printSuccess: vi.fn(),
  printError: vi.fn(),
  colors: {
    reset: '',
    green: '',
    yellow: '',
    red: '',
    blue: '',
    cyan: '',
    dim: '',
    bold: '',
  },
}));

import { run as runAgent } from '../commands/agent';
import { run as runCard } from '../commands/card';
import { run as runEdition } from '../commands/edition';
import { workerRequest } from '../lib/worker-client';

const workerRequestMock = vi.mocked(workerRequest);

describe('CLI commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('agent list --json calls /agents/list and prints JSON', async () => {
    workerRequestMock.mockResolvedValue({
      agents: [{ agentId: 'agent-1', type: 'beat-reporter', model: 'model-x' }],
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await runAgent(['list', '--json']);

    expect(workerRequestMock).toHaveBeenCalledWith('/agents/list');
    expect(logSpy).toHaveBeenCalledTimes(1);
    const output = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(output.success).toBe(true);
    expect(output.agents).toHaveLength(1);

    logSpy.mockRestore();
  });

  it('card list passes filters as query params', async () => {
    workerRequestMock.mockResolvedValue({ cards: [] });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await runCard(['list', '--type=weather', '--agent=beat-1', '--limit=5', '--json']);

    expect(workerRequestMock).toHaveBeenCalledWith(
      '/cards?type=weather&agentId=beat-1&limit=5'
    );

    logSpy.mockRestore();
  });

  it('edition get --latest uses latest endpoint', async () => {
    workerRequestMock.mockResolvedValue({
      edition: {
        id: 'edition-1',
        editionDate: '2025-01-01',
        curatorAgentId: 'agent-1',
        selectedCards: [],
        rejectedCards: [],
      },
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await runEdition(['get', '--latest', '--json']);

    expect(workerRequestMock).toHaveBeenCalledWith('/editions/latest');

    logSpy.mockRestore();
  });

});
