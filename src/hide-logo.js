import { configAddChangeListener, configRead } from './config';

const style = document.createElement('style');
document.head.appendChild(style);

/** @param {boolean} hide */
function setHidden(hide) {
  style.textContent = `ytlr-redux-connect-ytlr-logo-entity { visibility: ${hide ? 'hidden' : 'visible'}; }`;
}

setHidden(configRead('hideLogo'));
configAddChangeListener('hideLogo', setHidden);
