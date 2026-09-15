/**
 * The screen for features the backend does not have yet.
 *
 * The console was designed against a wider product than the API currently
 * exposes: draws, coupons, agents and an audit trail all have screens in the
 * design and no endpoint behind them.
 *
 * Deleting them would lose the design; faking them with local data would be
 * worse — an operator cannot tell invented numbers from real ones, and a
 * console that lies once is not trusted again. So the route stays, and it says
 * plainly that nothing is wired, naming the endpoints that would wire it.
 */

import { PlugZap } from 'lucide-react';
import { Card, Notice } from '@/components/ui';
import { PageHeader } from '@/components/page';

export interface NotLinkedProps {
  title: string;
  /** What this screen would do, in one line. */
  purpose: string;
  /** The routes the backend would have to expose. */
  missing: string[];
  /** What an operator can do in the meantime, when there is a workaround. */
  insteadNote?: string;
}

export function NotLinked({ title, purpose, missing, insteadNote }: NotLinkedProps) {
  return (
    <>
      <PageHeader title={title} subtitle="غير مربوطة بالـ API" />

      <div className="page">
        <Card pad>
          <Notice tone="warning" icon={<PlugZap size={16} />}>
            <span className="strong">هذي الشاشة ماكو إلها ربط مع الـ API.</span> الواجهة موجودة
            بالتصميم، بس السيرفر ما يوفّر endpoints إلها، فما تنعرض أي بيانات — وما ننزّل بيانات
            وهمية حتى ما تنخلط بالحقيقية.
          </Notice>

          <div className="col row-gap-3 mt-4">
            <div className="col">
              <span className="fs-small muted">وظيفتها</span>
              <span className="fs-body">{purpose}</span>
            </div>

            <div className="col">
              <span className="fs-small muted">الـ endpoints المطلوبة حتى تشتغل</span>
              <ul
                className="fs-body"
                style={{ margin: '6px 0 0', paddingInlineStart: 18, lineHeight: 1.9 }}
              >
                {missing.map((route) => (
                  <li key={route}>
                    <code className="num">{route}</code>
                  </li>
                ))}
              </ul>
            </div>

            {insteadNote ? (
              <div className="col">
                <span className="fs-small muted">لحد ما ينربط</span>
                <span className="fs-body">{insteadNote}</span>
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </>
  );
}
