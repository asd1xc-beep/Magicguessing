import { searchPlayers } from '../game/names.js';

export function attachAutocomplete({ document, input, getIndex, onInput = () => {} }) {
  let currentFocus = -1;

  function close() {
    document.getElementById('player-input-autocomplete-list')?.remove();
    currentFocus = -1;
  }

  function setActive(items) {
    for (const item of items) item.classList.remove('autocomplete-active');
    items[currentFocus].classList.add('autocomplete-active');
    items[currentFocus].scrollIntoView({ block: 'nearest' });
  }

  function handleInput() {
    close();
    onInput();
    const matches = searchPlayers(input.value, getIndex(), 8);
    if (!matches.length) return;

    const list = document.createElement('div');
    list.id = 'player-input-autocomplete-list';
    list.className = 'autocomplete-items glass-panel';
    for (const match of matches) {
      const item = document.createElement('div');
      item.textContent = match.name;
      item.addEventListener('click', () => {
        input.value = match.name;
        close();
        input.focus();
      });
      list.appendChild(item);
    }
    input.parentNode.appendChild(list);
  }

  function handleKeydown(event) {
    const list = document.getElementById('player-input-autocomplete-list');
    const items = list ? [...list.getElementsByTagName('div')] : [];
    if (!items.length) return;
    if (event.key === 'ArrowDown') {
      currentFocus = (currentFocus + 1) % items.length;
      setActive(items);
      event.preventDefault();
    } else if (event.key === 'ArrowUp') {
      currentFocus = (currentFocus - 1 + items.length) % items.length;
      setActive(items);
      event.preventDefault();
    } else if (event.key === 'Enter' && currentFocus > -1) {
      event.preventDefault();
      items[currentFocus].click();
    } else if (event.key === 'Escape') {
      close();
    }
  }

  function handleDocumentClick(event) {
    if (event.target !== input) close();
  }

  input.addEventListener('input', handleInput);
  input.addEventListener('keydown', handleKeydown);
  document.addEventListener('click', handleDocumentClick);

  return {
    close,
    destroy() {
      close();
      input.removeEventListener('input', handleInput);
      input.removeEventListener('keydown', handleKeydown);
      document.removeEventListener('click', handleDocumentClick);
    },
  };
}

