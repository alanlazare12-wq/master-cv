export const APP_MAJOR=48;
export const APP_VERSION='48.0.0-personal';
export const APP_LABEL='Hoja Personal CV Studio v48';
export const storageKey=(suffix='')=>`hoja-personal-v${APP_MAJOR}${suffix?'-'+suffix:''}`;
export const legacyStorageKeys=(suffix='',min=14)=>Array.from({length:APP_MAJOR-min},(_,i)=>`hoja-personal-v${APP_MAJOR-1-i}${suffix?'-'+suffix:''}`);
