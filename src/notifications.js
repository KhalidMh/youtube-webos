import './notifications.css';

const COLOR_MAP = {
  red: 'rgba(255, 0, 0, 0.9)',
  green: 'rgba(0, 162, 0, 0.9)',
  yellow: 'rgba(255, 255, 0, 0.9)',
  blue: 'rgba(0, 128, 255, 0.9)',
  grey: 'rgba(255, 255, 255, 0.5)',
  none: 'rgba(0, 0, 0, 0)'
};

/**
 * Shows a toast in the bottom-right corner.
 * @param {string} text
 * @param {number} [time] How long it stays, in ms.
 * @param {string} [color] A name from `COLOR_MAP`, or any CSS color.
 */
export function showNotification(text, time = 3000, color = 'grey') {
  let container = document.querySelector('.ytaf-notification-container');
  if (!container) {
    container = document.createElement('div');
    container.classList.add('ytaf-notification-container');
    document.body.appendChild(container);
  }

  const elm = document.createElement('div');
  const elmInner = document.createElement('div');
  elmInner.innerText = text;
  elmInner.classList.add('message');
  elmInner.classList.add('message-hidden');
  elmInner.style.borderColor = COLOR_MAP[color] || color;
  elm.appendChild(elmInner);
  container.appendChild(elm);

  setTimeout(() => {
    elmInner.classList.remove('message-hidden');
  }, 100);
  setTimeout(() => {
    elmInner.classList.add('message-hidden');
    setTimeout(() => {
      elm.remove();
    }, 1000);
  }, time);
}
