if (!customElements.get('vent-kit-picker')) {
  customElements.define(
    'vent-kit-picker',
    class VentKitPicker extends HTMLElement {
      constructor() {
        super();
        this.onChange = this.onChange.bind(this);
      }

      connectedCallback() {
        this.image = this.querySelector('[data-vent-kit-image]');
        this.emptyState = this.querySelector('[data-vent-kit-empty]');
        this.summary = this.querySelector('[data-selection-summary]');
        this.topInputs = Array.from(this.querySelectorAll('[data-vent-top]'));
        this.rearInputs = Array.from(this.querySelectorAll('[data-vent-rear]'));
        this.imageMap = this.readJson('[data-vent-kit-images]') || {};
        this.optionNames = this.readJson('[data-vent-kit-option-names]') || [];

        this.topInputs.forEach((input) => input.addEventListener('change', this.onChange));
        this.rearInputs.forEach((input) => input.addEventListener('change', this.onChange));

        this.syncFromCurrentVariant();
        this.onChange();
      }

      disconnectedCallback() {
        this.topInputs.forEach((input) => input.removeEventListener('change', this.onChange));
        this.rearInputs.forEach((input) => input.removeEventListener('change', this.onChange));
      }

      readJson(selector) {
        const el = this.querySelector(selector);
        if (!el) return null;
        try {
          return JSON.parse(el.textContent);
        } catch (error) {
          console.error('Vent kit picker JSON parse failed', error);
          return null;
        }
      }

      getTopValue() {
        const selected = this.topInputs.find((input) => input.checked);
        return selected ? selected.value : 'None';
      }

      getRearValue() {
        const selected = this.rearInputs.find((input) => input.checked);
        return selected ? selected.value : 'None';
      }

      setRadioValue(inputs, value) {
        const match = inputs.find((input) => input.value === value && !input.disabled);
        if (match) {
          match.checked = true;
          return;
        }
        const fallback = inputs.find((input) => input.value !== 'None' && !input.disabled) ||
          inputs.find((input) => !input.disabled);
        if (fallback) fallback.checked = true;
      }

      getNoneInput(inputs) {
        return inputs.find((input) => input.value === 'None');
      }

      /**
       * Both Top and Rear cannot be None at once.
       * Disable the other None option when one side is already None.
       */
      enforceNotBothNone() {
        const top = this.getTopValue();
        const rear = this.getRearValue();
        const topNone = this.getNoneInput(this.topInputs);
        const rearNone = this.getNoneInput(this.rearInputs);

        if (top === 'None' && rear === 'None') {
          // Prefer rear-only 1R when forcing a valid selection
          this.setRadioValue(this.rearInputs, '1');
        }

        if (topNone) {
          topNone.disabled = this.getRearValue() === 'None';
          topNone.closest('.vent-kit-picker__choice')?.classList.toggle('is-disabled', topNone.disabled);
        }
        if (rearNone) {
          rearNone.disabled = this.getTopValue() === 'None';
          rearNone.closest('.vent-kit-picker__choice')?.classList.toggle('is-disabled', rearNone.disabled);
        }
      }

      /**
       * Build asset filename from selection.
       * Top None + Rear 1 → 1R.png
       * Rear "1 + PSU" uses the *_1R_PSU art (rear duct + PSU duct).
       */
      getImageFilename(top = this.getTopValue(), rear = this.getRearValue()) {
        if (top === 'None' && rear === '1') return '1R.png';
        if (top === 'None' && (rear === '1 + PSU' || rear === 'PSU')) return '1R_PSU.png';

        const parts = [];
        if (top !== 'None') parts.push(`${top}T`);
        if (rear === '1') parts.push('1R');
        if (rear === '1 + PSU' || rear === 'PSU') parts.push('1R', 'PSU');
        if (!parts.length) return null;
        return `${parts.join('_')}.png`;
      }

      hasSelection() {
        return this.getTopValue() !== 'None' || this.getRearValue() !== 'None';
      }

      onChange() {
        this.enforceNotBothNone();
        this.updateOptions();
        this.updateDiagram();
        this.updateMasterId();
        this.updateSelectionSummary();
        this.toggleAddButton(true, '', false);
        this.updatePickupAvailability();
        this.removeErrorMessage();

        if (!this.hasSelection()) {
          this.toggleAddButton(true, 'Select fan options', true);
          return;
        }

        if (!this.currentVariant) {
          this.toggleAddButton(true, '', true);
          this.setUnavailable();
          return;
        }

        this.updateURL();
        this.updateVariantInput();
        this.renderProductInfo();
        this.updateShareUrl();
      }

      updateOptions() {
        this.options = [this.getTopValue(), this.getRearValue()];
      }

      updateDiagram() {
        const filename = this.getImageFilename();
        const src = filename ? this.imageMap[filename] : null;

        if (!src) {
          if (this.image) this.image.hidden = true;
          if (this.emptyState) this.emptyState.hidden = false;
          return;
        }

        if (this.image) {
          this.image.hidden = false;
          if (this.image.getAttribute('src') !== src) this.image.setAttribute('src', src);
        }
        if (this.emptyState) this.emptyState.hidden = true;
      }

      updateMasterId() {
        const variants = this.getVariantData();
        const [topValue, rearValue] = this.options;
        const topIndex = this.findOptionIndex(/top/i, 0);
        const rearIndex = this.findOptionIndex(/rear/i, 1);

        this.currentVariant = variants.find((variant) => {
          const topMatch = topIndex < 0 || variant.options[topIndex] === topValue;
          const rearMatch = rearIndex < 0 || variant.options[rearIndex] === rearValue;
          return topMatch && rearMatch;
        });
      }

      findOptionIndex(pattern, fallback) {
        const index = this.optionNames.findIndex((name) => pattern.test(name));
        return index >= 0 ? index : fallback;
      }

      syncFromCurrentVariant() {
        const params = new URLSearchParams(window.location.search);
        const variantId = Number(params.get('variant'));
        if (!variantId) return;

        const current = this.getVariantData().find((variant) => variant.id === variantId);
        if (!current || !current.options) return;

        const topIndex = this.findOptionIndex(/top/i, 0);
        const rearIndex = this.findOptionIndex(/rear/i, 1);
        const topOption = current.options[topIndex] || 'None';
        const rearOption = current.options[rearIndex] || 'None';
        this.setRadioValue(this.topInputs, topOption);
        this.setRadioValue(this.rearInputs, rearOption);
      }

      updateSelectionSummary() {
        if (!this.summary) return;

        if (!this.hasSelection()) {
          this.summary.hidden = true;
          this.summary.textContent = '';
          return;
        }

        const filename = this.getImageFilename();
        this.summary.hidden = false;
        this.summary.textContent = filename
          ? `Selected: Top ${this.options[0]} / Rear ${this.options[1]}`
          : 'Select at least one fan option';
      }

      updateURL() {
        if (!this.currentVariant || this.dataset.updateUrl === 'false') return;
        window.history.replaceState({}, '', `${this.dataset.url}?variant=${this.currentVariant.id}`);
      }

      updateShareUrl() {
        const shareButton = document.getElementById(`Share-${this.dataset.section}`);
        if (!shareButton || !shareButton.updateUrl) return;
        shareButton.updateUrl(`${window.shopUrl}${this.dataset.url}?variant=${this.currentVariant.id}`);
      }

      updateVariantInput() {
        const productForms = document.querySelectorAll(
          `#product-form-${this.dataset.section}, #product-form-installment-${this.dataset.section}`
        );
        productForms.forEach((productForm) => {
          const input = productForm.querySelector('input[name="id"]');
          if (!input) return;
          input.value = this.currentVariant.id;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        });
      }

      updatePickupAvailability() {
        const pickUpAvailability = document.querySelector('pickup-availability');
        if (!pickUpAvailability) return;

        if (this.currentVariant && this.currentVariant.available) {
          pickUpAvailability.fetchAvailability(this.currentVariant.id);
        } else {
          pickUpAvailability.removeAttribute('available');
          pickUpAvailability.innerHTML = '';
        }
      }

      removeErrorMessage() {
        const section = this.closest('section');
        if (!section) return;
        const productForm = section.querySelector('product-form');
        if (productForm) productForm.handleErrorMessage();
      }

      renderProductInfo() {
        fetch(
          `${this.dataset.url}?variant=${this.currentVariant.id}&section_id=${
            this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section
          }`
        )
          .then((response) => response.text())
          .then((responseText) => {
            const html = new DOMParser().parseFromString(responseText, 'text/html');
            const destination = document.getElementById(`price-${this.dataset.section}`);
            const source = html.getElementById(
              `price-${this.dataset.originalSection ? this.dataset.originalSection : this.dataset.section}`
            );
            if (source && destination) destination.innerHTML = source.innerHTML;

            const price = document.getElementById(`price-${this.dataset.section}`);
            if (price) price.classList.remove('visibility-hidden');
            this.toggleAddButton(!this.currentVariant.available, window.variantStrings.soldOut);
          });
      }

      toggleAddButton(disable = true, text, modifyClass = true) {
        const productForm = document.getElementById(`product-form-${this.dataset.section}`);
        if (!productForm) return;
        const addButton = productForm.querySelector('[name="add"]');
        const addButtonText = productForm.querySelector('[name="add"] > span');
        if (!addButton) return;

        if (disable) {
          addButton.setAttribute('disabled', 'disabled');
          if (text) addButtonText.textContent = text;
        } else {
          addButton.removeAttribute('disabled');
          addButtonText.textContent = window.variantStrings.addToCart;
        }

        if (!modifyClass) return;
      }

      setUnavailable() {
        const button = document.getElementById(`product-form-${this.dataset.section}`);
        const addButton = button.querySelector('[name="add"]');
        const addButtonText = button.querySelector('[name="add"] > span');
        const price = document.getElementById(`price-${this.dataset.section}`);
        if (!addButton) return;
        addButtonText.textContent = window.variantStrings.unavailable;
        if (price) price.classList.add('visibility-hidden');
      }

      getVariantData() {
        this.variantData = this.variantData || this.readJson('[data-vent-kit-variants]') || [];
        return this.variantData;
      }
    }
  );
}
