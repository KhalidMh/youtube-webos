import './yt-fixes.css';

const bodyClasses = document.body.classList;

// `classList.remove` rewrites the attribute even when the class is absent,
// which would trigger the observer again.
new MutationObserver(() => {
  if (bodyClasses.contains('app-quality-root')) {
    bodyClasses.remove('app-quality-root');
  }
}).observe(document.body, { attributes: true, attributeFilter: ['class'] });
