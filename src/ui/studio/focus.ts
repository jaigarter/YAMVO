/** Which studio area last received a pointer interaction (for Delete / ⌘D / ⌘A). */
export type FocusArea = 'timeline' | 'editor' | 'none';
let area: FocusArea = 'none';
export const setFocusArea = (a: FocusArea) => void (area = a);
export const getFocusArea = () => area;
