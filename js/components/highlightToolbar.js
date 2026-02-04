/**
 * Highlight Toolbar Component
 * Floating toolbar for selecting highlight colors and deleting highlights
 */

const HIGHLIGHT_COLORS = {
  orange: '#FFB84D',
  yellow: '#FFEB3B',
  green: '#81C784',
  blue: '#64B5F6',
  purple: '#BA68C8',
  pink: '#F48FB1'
};

export class HighlightToolbar {
  constructor(onColorSelect, onDelete) {
    this.onColorSelect = onColorSelect;
    this.onDelete = onDelete;
    this.toolbar = null;
    this.isVisible = false;
  }

  /**
   * Create the toolbar HTML
   */
  create() {
    const toolbar = document.createElement('div');
    toolbar.className = 'highlight-toolbar';
    toolbar.setAttribute('aria-label', 'Highlight toolbar');

    // Color buttons
    const colorContainer = document.createElement('div');
    colorContainer.className = 'highlight-toolbar-colors';

    Object.entries(HIGHLIGHT_COLORS).forEach(([colorName, colorValue]) => {
      const button = document.createElement('button');
      button.className = 'highlight-color-btn';
      button.style.backgroundColor = colorValue;
      button.title = `Highlight in ${colorName}`;
      button.setAttribute('aria-label', `Highlight in ${colorName}`);
      button.dataset.color = colorValue;
      button.dataset.colorName = colorName;

      button.addEventListener('click', (e) => {
        e.stopPropagation();
        this.onColorSelect(colorValue, colorName);
        this.hide();
      });

      colorContainer.appendChild(button);
    });

    // Delete button
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'highlight-delete-btn';
    deleteBtn.innerHTML = '<i class="fas fa-trash-alt"></i>';
    deleteBtn.title = 'Delete highlight';
    deleteBtn.setAttribute('aria-label', 'Delete highlight');

    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.onDelete();
      this.hide();
    });

    toolbar.appendChild(colorContainer);
    toolbar.appendChild(deleteBtn);

    // Hide toolbar when clicking outside
    document.addEventListener('click', (e) => {
      if (this.isVisible && !toolbar.contains(e.target)) {
        this.hide();
      }
    });

    this.toolbar = toolbar;
    document.body.appendChild(toolbar);
  }

  /**
   * Show toolbar at specified position
   * @param {number} x - X coordinate
   * @param {number} y - Y coordinate (slightly above selection)
   */
  show(x, y) {
    if (!this.toolbar) {
      this.create();
    }

    this.toolbar.style.display = 'flex';
    this.toolbar.style.left = x + 'px';
    this.toolbar.style.top = y + 'px';
    this.isVisible = true;
  }

  /**
   * Hide toolbar
   */
  hide() {
    if (this.toolbar) {
      this.toolbar.style.display = 'none';
      this.isVisible = false;
    }
  }

  /**
   * Destroy toolbar
   */
  destroy() {
    if (this.toolbar) {
      this.toolbar.remove();
      this.toolbar = null;
    }
  }
}
