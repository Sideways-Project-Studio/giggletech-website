if (!customElements.get('vent-kit-picker')) {
  customElements.define(
    'vent-kit-picker',
    class VentKitPicker extends HTMLElement {
      constructor() {
        super();
        this.onChange = this.onChange.bind(this);
      }

      connectedCallback() {
        this.checkboxes = Array.from(this.querySelectorAll('input[type="checkbox"]'));
        this.summary = this.querySelector('[data-selection-summary]');
        this.checkboxes.forEach((checkbox) => checkbox.addEventListener('change', this.onChange));
        this.syncFromCurrentVariant();
        this.onChange();
      }

      disconnectedCallback() {
        this.checkboxes.forEach((checkbox) => checkbox.removeEventListener('change', this.onChange));
      }

      onChange() {
        this.updateOptions();
        this.updateMasterId();
        this.updateSelectionSummary();
        this.toggleAddButton(true, '', false);
        this.updatePickupAvailability();
        this.removeErrorMessage();

        if (!this.hasSelection()) {
          this.toggleAddButton(true, 'Select mount points', true);
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

      hasSelection() {
        return this.checkboxes.some((checkbox) => checkbox.checked);
      }

      getTopOptionValue() {
        const rear = this.isChecked('top', 'rear');
        const front = this.isChecked('top', 'front');
        if (rear && front) return 'Top rear + Top front';
        if (rear) return 'Top rear';
        if (front) return 'Top front';
        return 'None';
      }

      getSideOptionValue() {
        const upper = this.isChecked('side', 'upper');
        const lower = this.isChecked('side', 'lower');
        if (upper && lower) return 'Side upper + Side lower';
        if (upper) return 'Side upper';
        if (lower) return 'Side lower';
        return 'None';
      }

      isChecked(group, part) {
        return this.checkboxes.some(
          (checkbox) => checkbox.dataset.group === group && checkbox.dataset.part === part && checkbox.checked
        );
      }

      updateOptions() {
        this.options = [this.getTopOptionValue(), this.getSideOptionValue()];
      }

      updateMasterId() {
        this.currentVariant = this.getVariantData().find((variant) => {
          return !variant.options
            .map((option, index) => this.options[index] === option)
            .includes(false);
        });
      }

      syncFromCurrentVariant() {
        const params = new URLSearchParams(window.location.search);
        const variantId = Number(params.get('variant'));
        if (!variantId) return;

        const current = this.getVariantData().find((variant) => variant.id === variantId);
        if (!current || !current.options) return;

        const [topOption = 'None', sideOption = 'None'] = current.options;
        this.setCheckbox('top', 'rear', /Top rear/.test(topOption));
        this.setCheckbox('top', 'front', /Top front/.test(topOption));
        this.setCheckbox('side', 'upper', /Side upper/.test(sideOption));
        this.setCheckbox('side', 'lower', /Side lower/.test(sideOption));
      }

      setCheckbox(group, part, checked) {
        const checkbox = this.checkboxes.find(
          (input) => input.dataset.group === group && input.dataset.part === part
        );
        if (checkbox) checkbox.checked = checked;
      }

      updateSelectionSummary() {
        if (!this.summary) return;

        if (!this.hasSelection()) {
          this.summary.hidden = true;
          this.summary.textContent = '';
          return;
        }

        this.summary.hidden = false;
        this.summary.textContent = `Selected: ${this.options.join(' / ')}`;
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
        this.variantData =
          this.variantData || JSON.parse(this.querySelector('[type="application/json"]').textContent);
        return this.variantData;
      }
    }
  );
}
