document.documentElement.classList.add('js');

for (const button of document.querySelectorAll('[data-copy]')) {
  button.addEventListener('click', async () => {
    const value = document.getElementById(button.dataset.copy).textContent;
    const status = button.querySelector('[role="status"]');
    try {
      await navigator.clipboard.writeText(value);
      status.textContent = 'Copied';
    } catch {
      status.textContent = 'Select text to copy';
      const range = document.createRange();
      range.selectNodeContents(document.getElementById(button.dataset.copy));
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
    }
    setTimeout(() => { status.textContent = 'Copy'; }, 2500);
  });
}
