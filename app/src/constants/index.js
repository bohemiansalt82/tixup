export const CELL_WIDTH = 48;
export const VIRTUAL_WIDTH = 35000;
export const CENTER_PX = 1000000;
export const INITIAL_PAN_OFFSET = CENTER_PX - VIRTUAL_WIDTH / 2;

export const BASE_EPOCH = (() => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
})();

export const STATUS_LABELS = {
  pending: 'Pending',
  inprogress: 'In Progress',
  done: 'Done',
  overdue: 'Overdue',
  pause: 'Pause',
  drop: 'Drop',
};

export const STORAGE_KEY = 'tixup_master_v1';
