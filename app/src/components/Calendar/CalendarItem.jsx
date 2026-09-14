import { Fragment } from 'react';

const dotIcon = `${import.meta.env.BASE_URL}images/calendar/dot.svg`;

/**
 * Calendar block — Figma Tixup-V2.0 "Item for Calendar" 37651:9139.
 * The block is a parent Tix; the line under the title lists its sub-tix titles.
 *
 * direction: 'both' (starts and ends this week) | 'start' (continues into next week, Figma
 * Direction=Left) | 'end' (continued from last week, Figma Direction=Right) | 'middle'.
 * interaction: 'default' | 'drag' (translucent blurred ghost, Figma 37658:5809).
 */
export function CalendarItem({ title, subTix = [], color = 'yellow', direction = 'both', interaction = 'default', active = false, onHandlePointerDown, style, ...rest }) {
  const cls = ['cv-item', `cv-item-${color}`, `cv-dir-${direction}`, interaction === 'drag' ? 'cv-item-drag' : '', active ? 'cv-item-active' : ''].filter(Boolean).join(' ');
  const showStart = interaction !== 'drag' && (direction === 'both' || direction === 'start');
  const showEnd = interaction !== 'drag' && (direction === 'both' || direction === 'end');

  return (
    <div className={cls} style={style} {...rest}>
      <div className="cv-item-bg" />
      <div className="cv-item-title-row">
        <span className={`cv-item-title${title ? '' : ' cv-item-untitled'}`}>{title || 'New Tix'}</span>
      </div>
      {subTix.length > 0 && (
        <div className="cv-item-sub-row">
          {subTix.map((name, i) => (
            <Fragment key={`${name}-${i}`}>
              {i > 0 && <img className="cv-item-dot" src={dotIcon} alt="" width={4} height={4} />}
              <span className="cv-item-sub">{name}</span>
            </Fragment>
          ))}
        </div>
      )}
      {showStart && <div className="cv-handle cv-handle-start" onPointerDown={(e) => onHandlePointerDown?.('start', e)} aria-hidden="true" />}
      {showEnd && <div className="cv-handle cv-handle-end" onPointerDown={(e) => onHandlePointerDown?.('end', e)} aria-hidden="true" />}
    </div>
  );
}
