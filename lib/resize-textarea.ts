/** Measure after resetting height so both longer and shorter messages fit. */
export function resizeTextarea(textarea:HTMLTextAreaElement){
 textarea.style.height='auto';
 const borders=textarea.offsetHeight-textarea.clientHeight;
 textarea.style.height=`${textarea.scrollHeight+Math.max(0,borders)}px`;
}
