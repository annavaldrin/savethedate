class MyCarousel extends HTMLElement {
  get selected() {
    return this._selected;
  }
  set selected(selected) {
    if (this._selected !== selected) {
      const oldSelected = this._selected;
      this._selected = selected;
      this._selectedChanged(selected, oldSelected);
    }
  }
  previous() {
    const elem = this.selected && this.selected.previousElementSibling;
    if (elem && !this._touchDir) {
      // Setup transition start state
      const oldSelected = this.selected;
      this._translateX(oldSelected, 0);
      this._translateX(elem, -this._width);
      // Start the transition
      this.selected = elem;
      this._translateX(oldSelected, this._width, true /* transition */);
      this._translateX(elem, 0, true /* transition */);
    }
  }
  next() {
    const elem = this.selected && this.selected.nextElementSibling;
    if (elem && !this._touchDir) {
      // Setup transition start state
      const oldSelected = this.selected;
      this._translateX(oldSelected, 0);
      this._translateX(elem, this._width);
      // Start the transition
      this.selected = elem;
      this._translateX(oldSelected, -this._width, true /* transition */);
      this._translateX(elem, 0, true /* transition */);
    }
  }
  connectedCallback() {
    if (!this.shadowRoot) {
      this._firstConnected();
    }
    if (!this.intersecting && 'IntersectionObserver' in window) {
      this.observer =
        new IntersectionObserver((entries) => {
          if (entries.some(({ isIntersecting }) => isIntersecting)) {
            this._connectedAndVisible();
          }
        }, { rootMargin: '10px' });
      this.observer.observe(this);
    }
    else {
      this._connectedAndVisible();
    }
  }

  disconnectedCallback() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    window.removeEventListener('resize', this);
    this.intersecting = false;
  }

  _connectedAndVisible() {
    this.intersecting = true;
    window.addEventListener('resize', this);
    this._onResize();
    this._resetSelected();
    this.observer.disconnect();
    this.observer = null;
  }

  _firstConnected() {
    this.attachShadow({ mode: 'open' }).innerHTML = `
    <style>
      :host {
        display: block;
        position: relative;
        overflow: hidden;
        contain: content;
      }
      div {
        position: absolute;
        width: 100%;
        height: 100%;
      }
      div > ::slotted(:not([selected])) {
        display: none;
      }
      div > ::slotted(*) {
        will-change: transform;
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
      }
      button {
        will-change: opacity;
        position: absolute;
        top: 0;
        bottom: 0;
        width: 40px;
        padding: 0;
        line-height: 40px;
        border: none;
        background: none;
        color: #DDD;
        font-size: 40px;
        font-weight: bold;
        opacity: 0.8;
        outline: 0;
        text-shadow: 0 1px 2px rgba(0, 0, 0, .6);
      }
      button:not([disabled]) {
        cursor: pointer;
      }
      button:hover,
      button:focus {
        opacity: 1;
      }
      #prevBtn {
        left: 0;
      }
      #nextBtn {
        right: 0;
      }
      button[disabled] {
        opacity: 0.4;
      }
    </style>

    <div>
      <slot></slot>
    </div>

    <button id="prevBtn">&#x276E;</button>
    <button id="nextBtn">&#x276F;</button>
`;
    this._prevBtn = this.shadowRoot.getElementById('prevBtn');
    this._nextBtn = this.shadowRoot.getElementById('nextBtn');

    this.shadowRoot.addEventListener('slotchange', this);
    this._prevBtn.addEventListener('click', this);
    this._nextBtn.addEventListener('click', this);
    this.addEventListener('transitionend', this);
    this.addEventListener('touchstart', this, { passive: true });
    this.addEventListener('touchmove', this, { passive: false });
    this.addEventListener('touchend', this, { passive: true });
  }

  handleEvent(event) {
    switch (event.type) {
      case 'slotchange':
        this._resetSelected();
        break;
      case 'transitionend':
        this._resetChildrenStyles();
        break;
      case 'touchstart':
        this._touchstart(event);
        break;
      case 'touchmove':
        this._touchmove(event);
        break;
      case 'touchend':
        this._touchend(event);
        break;
      case 'resize':
        this._onResize();
        break;
      case 'click':
        if (event.target === this._prevBtn) {
          this.previous();
        } else if (event.target === this._nextBtn) {
          this.next();
        }
        break;
    }
  }
  _onResize() {
    this._resizeDeboncerId && cancelAnimationFrame(this._resizeDeboncerId);
    this._resizeDeboncerId = requestAnimationFrame(() => {
      this._width = this.offsetWidth;
    });
  }
  _resetSelected() {
    if (this.intersecting && (!this.selected || this.selected.parentElement !== this)) {
      this.selected = this.firstElementChild;
    }
  }
  _selectedChanged(selected, oldSelected) {
    if (oldSelected) oldSelected.removeAttribute('selected');
    if (selected) {
      selected.setAttribute('selected', '');
      this._prevBtn.disabled = !selected.previousElementSibling;
      this._nextBtn.disabled = !selected.nextElementSibling;

      this._loadImage(selected);
      this._loadImage(selected.previousElementSibling);
      this._loadImage(selected.nextElementSibling);
    } else {
      this._prevBtn.disabled = true;
      this._nextBtn.disabled = true;
    }
  }
  _loadImage(img) {
    if (img && img.getAttribute('data-src')) {
      img.src = img.getAttribute('data-src');
      img.removeAttribute('data-src');
    }
  }
  _translateX(elem, x, transition) {
    // Force style recalc by poking `transform`.
    if (transition) {
      getComputedStyle(elem).transform;
    }
    elem.style.display = 'block';
    elem.style.transition = transition ? 'transform 0.2s' : '';
    elem.style.transform = 'translate3d(' + x + 'px, 0, 0)';
  }
  _resetChildrenStyles() {
    let elem = this.firstElementChild;
    while (elem) {
      elem.style.display = '';
      elem.style.transition = '';
      elem.style.transform = '';
      elem = elem.nextElementSibling;
    }
  }
  _touchstart(event) {
    // No transition if less than two images
    if (this.childElementCount < 2) {
      return;
    }
    // Save start coordinates
    if (!this._touchDir) {
      this._startX = event.changedTouches[0].clientX;
      this._startY = event.changedTouches[0].clientY;
    }
  }
  _touchmove(event) {
    // No transition if less than two images
    if (this.childElementCount < 2) {
      return;
    }
    // Is touchmove mostly horizontal or vertical?
    if (!this._touchDir) {
      const absX = Math.abs(event.changedTouches[0].clientX - this._startX);
      const absY = Math.abs(event.changedTouches[0].clientY - this._startY);
      this._touchDir = absX > absY ? 'x' : 'y';
    }
    if (this._touchDir === 'x') {
      // Prevent vertically scrolling when swiping
      event.preventDefault();
      let dx = Math.round(event.changedTouches[0].clientX - this._startX);
      const prevChild = this.selected.previousElementSibling;
      const nextChild = this.selected.nextElementSibling;
      // Don't translate past the current image if there's no adjacent image in that direction
      if ((!prevChild && dx > 0) || (!nextChild && dx < 0)) {
        dx = 0;
      }
      this._translateX(this.selected, dx);
      if (prevChild) {
        this._translateX(prevChild, dx - this._width);
      }
      if (nextChild) {
        this._translateX(nextChild, dx + this._width);
      }
    }
  }
  _touchend(event) {
    // No transition if less than two images
    if (this.childElementCount < 2) {
      return;
    }
    // Don't finish swiping if there are still active touches.
    if (event.touches.length) {
      return;
    }
    if (this._touchDir === 'x') {
      let dx = Math.round(event.changedTouches[0].clientX - this._startX);
      const prevChild = this.selected.previousElementSibling;
      const nextChild = this.selected.nextElementSibling;
      // Don't translate past the current image if there's no adjacent image in that direction
      if ((!prevChild && dx > 0) || (!nextChild && dx < 0)) {
        dx = 0;
      }
      if (dx > 0) {
        if (dx > 100) {
          if (dx === this._width) {
            // No transitionend will fire (since we're already in the final state),
            // so reset children styles now
            this._resetChildrenStyles();
          } else {
            this._translateX(prevChild, 0, true);
            this._translateX(this.selected, this._width, true);
          }
          this.selected = prevChild;
        } else {
          this._translateX(prevChild, -this._width, true);
          this._translateX(this.selected, 0, true);
        }
      } else if (dx < 0) {
        if (dx < -100) {
          if (dx === -this._width) {
            // No transitionend will fire (since we're already in the final state),
            // so reset children styles now
            this._resetChildrenStyles();
          } else {
            this._translateX(this.selected, -this._width, true);
            this._translateX(nextChild, 0, true);
          }
          this.selected = nextChild;
        } else {
          this._translateX(this.selected, 0, true);
          this._translateX(nextChild, this._width, true);
        }
      } else {
        // No transitionend will fire (since we're already in the final state),
        // so reset children styles now
        this._resetChildrenStyles();
      }
    }
    // Reset touch direction
    this._touchDir = null;
  }
}
// Register custom element definition using standard platform API
customElements.define('my-carousel', MyCarousel);