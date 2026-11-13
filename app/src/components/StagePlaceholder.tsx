import type { ReactNode } from 'react';

type StagePlaceholderProps = {
  title: string;
  children: ReactNode;
  stage?: string;
};

export function StagePlaceholder({ title, children, stage }: StagePlaceholderProps) {
  return (
    <section className="page-panel" aria-labelledby="page-title">
      <h2 id="page-title">{title}</h2>
      <p>{children}</p>
      {stage ? (
        <ul className="stage-list">
          <li>
            <b>目前狀態</b>
            <span>{stage}</span>
          </li>
        </ul>
      ) : null}
    </section>
  );
}
