'use client';

import type { ScenarioReplay } from '../../lib/scenario-replay';

interface Props {
  replay: ScenarioReplay | null;
  cursor: number;
}

const ResultRow = ({ label, value }: { label: string; value: boolean }) => (
  <div className="stat-row">
    <span className="stat-label" style={{ flex: 1 }}>{label}</span>
    <span className={`badge ${value ? 'badge-lo' : 'badge-crit'}`}>
      {value ? 'yes' : 'no'}
    </span>
  </div>
);

export function ScenarioPanel({ replay, cursor }: Props) {
  if (!replay) return <div className="empty">Select a scenario replay to inspect it.</div>;

  const current = cursor > 0 ? replay.events[cursor - 1] : null;
  const progress = replay.events.length ? Math.round((cursor / replay.events.length) * 100) : 0;

  return (
    <div>
      <div className="section-h">
        <span>{replay.title}</span>
        <span className="cnt">{progress}%</span>
      </div>
      <div className="card" style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, lineHeight: 1.5 }}>{replay.description}</div>
        <div className="progress-bar" style={{ height: 7, marginTop: 8 }}>
          <div className="fill" style={{ width: `${progress}%` }} />
        </div>
        <div className="agent-stats" style={{ marginTop: 5 }}>
          {cursor} / {replay.events.length} events · {replay.result.completedRounds} rounds
        </div>
      </div>

      {current && (
        <div className="card" style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 4 }}>
            Round {current.round} · {current.kind.toUpperCase()}
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 3 }}>
            {current.agentName}{current.target ? ` → ${current.target}` : ''}
          </div>
          <div style={{ fontSize: 11, lineHeight: 1.45 }}>{current.message}</div>
        </div>
      )}

      <div className="section-h"><span>Evaluation</span></div>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Outcome</span>
          <span className={`badge ${replay.result.resolved ? 'badge-lo' : 'badge-crit'}`}>
            {replay.result.outcome}
          </span>
        </div>
        <ResultRow label="Resolution achieved" value={replay.result.resolved} />
        <ResultRow label="Conflict emerged" value={replay.result.conflictEmerged} />
        <ResultRow label="Cook goal addressed" value={replay.result.cookGoalAddressed} />
        <ResultRow label="Housemate goal addressed" value={replay.result.sensitiveHousemateGoalAddressed} />
        <ResultRow label="Ventilation agreed" value={replay.result.ventilationProtocolAgreed} />
        <ResultRow label="Dedicated cookware agreed" value={replay.result.dedicatedCookwareAgreed} />
      </div>

      <div className="section-h"><span>Participants</span></div>
      {replay.participants.map((participant) => (
        <div className="card" key={participant.id} style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 12, fontWeight: 600 }}>{participant.name}</div>
          <div style={{ fontSize: 10, color: 'var(--accent)', margin: '2px 0 4px' }}>
            {participant.scenarioRole} · {participant.role}
          </div>
          <div style={{ fontSize: 10, lineHeight: 1.4, color: 'var(--muted)' }}>
            {participant.goal}
          </div>
        </div>
      ))}
    </div>
  );
}
