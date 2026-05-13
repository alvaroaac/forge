type ActivityRowProps = {
  id: string;
  text: string;
  ts: string;
};

export function ActivityRow({ id, text, ts }: ActivityRowProps) {
  return (
    <div className="activity-row">
      <span className="mono activity-id">{id}</span>
      <span className="activity-text">{text}</span>
      <span className="mono dim activity-ts">{ts}</span>
    </div>
  );
}
