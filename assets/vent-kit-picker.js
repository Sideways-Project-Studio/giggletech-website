if (!customElements.get('vent-kit-picker')) {
  customElements.define(
    'vent-kit-picker',
    class VentKitPicker extends HTMLElement {
      constructor() {
        super();
        this.onChange = this.onChange.bind(this);
      }

      connectedCallback() {
        this.lengthInputs = Array.from(this.querySelectorAll('input[name="properties[Length]"]'));
        this.customDetails = this.querySelector('[data-custom-details]');
        this.customNote = this.querySelector('[data-custom-note]');
        this.customError = this.querySelector('[data-custom-error]');
        this.lengthInputs.forEach((input) => input.addEventListener('change', this.onChange));
        if (this.customNote) this.customNote.addEventListener('input', this.onChange);
        this.onChange();
      }

      disconnectedCallback() {
        this.lengthInputs.forEach((input) => input.removeEventListener('change', this.onChange));
        if (this.customNote) this.customNote.removeEventListener('input', this.onChange);
      }

      onChange() {
        const customSelected = this.lengthInputs.some((input) => input.checked && input.hasAttribute('data-custom-length'));
        const noteMissing = customSelected && !this.customNote.value.trim();

        this.customDetails.hidden = !customSelected;
        this.customNote.required = customSelected;
        this.customError.hidden = !noteMissing;
        this.toggleAddButton(noteMissing);
      }

      toggleAddButton(disable) {
        const productForm = document.getElementById(`product-form-${this.dataset.section}`);
        if (!productForm) return;
        const addButton = productForm.querySelector('[name="add"]');
        const addButtonText = productForm.querySelector('[name="add"] > span');
        if (!addButton) return;

        if (disable) {
          if (addButton.dataset.ventKitDisabled !== 'true') {
            addButton.dataset.ventKitWasDisabled = String(
              addButton.hasAttribute('disabled') || addButton.getAttribute('aria-disabled') === 'true'
            );
            addButton.dataset.ventKitOriginalText = addButtonText ? addButtonText.textContent : '';
          }
          addButton.setAttribute('disabled', 'disabled');
          addButton.setAttribute('aria-disabled', 'true');
          addButton.dataset.ventKitDisabled = 'true';
          if (addButtonText) addButtonText.textContent = 'Enter custom length';
        } else if (addButton.dataset.ventKitDisabled === 'true') {
          const wasDisabled = addButton.dataset.ventKitWasDisabled === 'true';
          if (!wasDisabled) {
            addButton.removeAttribute('disabled');
            addButton.removeAttribute('aria-disabled');
          }
          if (addButtonText) addButtonText.textContent = addButton.dataset.ventKitOriginalText;
          delete addButton.dataset.ventKitDisabled;
          delete addButton.dataset.ventKitWasDisabled;
          delete addButton.dataset.ventKitOriginalText;
        }
      }
    }
  );
}
