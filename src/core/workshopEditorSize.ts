/** Keep the mobile Bash editor fully visible to the page's vertical scroll.
 * Call after content or width changes; measurement is performed after resetting
 * the previous inline height so shrinking, wrapping and rotation all work.
 */
export interface WorkshopTextareaSize {
  style:{height:string};
  scrollHeight:number;
  offsetHeight:number;
  clientHeight:number;
}

export function fitWorkshopEditor(element:WorkshopTextareaSize):number {
  element.style.height='auto';
  // scrollHeight excludes borders, while global CSS uses border-box sizing.
  const border=Math.max(0,element.offsetHeight-element.clientHeight);
  const target=Math.max(112,Math.ceil(element.scrollHeight+border));
  element.style.height=target+'px';
  return target;
}
