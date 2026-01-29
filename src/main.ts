import {Plugin, BasesView, QueryController, HoverPopover, HoverParent, Keymap, MarkdownRenderer, TFile, NullValue, DateValue} from 'obsidian';

export const NotecardsViewType = 'notecards-view';

export default class NotecardsViewPlugin extends Plugin {

	onload() {
		this.registerBasesView(NotecardsViewType, {
      		name: 'Notecards',
      		icon: 'lucide-file-text',
      		factory: (controller, containerEl) => new MyBasesView(controller, containerEl),
    	});
	}

}

// Add `implements HoverParent` to enable hovering over file links.
export class MyBasesView extends BasesView implements HoverParent {

  readonly type = NotecardsViewType;
  hoverPopover: HoverPopover | null;
  private containerEl: HTMLElement;
  private createdObjectUrls: string[] = [];

  constructor(controller: QueryController, parentEl: HTMLElement) {
    super(controller);
    this.containerEl = parentEl.createDiv('bases-notecards-view-container');
    this.hoverPopover = null;
    this.createdObjectUrls = [];
  }

  onClose() {
    // Clean up created object URLs to prevent memory leaks
    this.createdObjectUrls.forEach(url => {
      URL.revokeObjectURL(url);
    });
    this.createdObjectUrls = [];
  }

  public onDataUpdated(): void {
    const { app } = this;

    // Clear entries created by previous iterations
    this.containerEl.empty();

    // Get visible properties selected by the user
    const visibleProperties = this.data.properties;

    // Create a card container with grid layout
    const cardContainerEl = this.containerEl.createDiv('bases-card-container');

    // Process each group and entry
    for (const group of this.data.groupedData) {
      for (const entry of group.entries) {
        // Skip non-markdown files
        if (!entry.file.path.endsWith('.md')) {
          continue;
        }

        // Create card as a link element
        const cardEl = cardContainerEl.createEl('a', 'bases-card');

        // Add click event to open file
        cardEl.onClickEvent((evt) => {
          if (evt.button !== 0 && evt.button !== 1) return;
          evt.preventDefault();
          const path = entry.file.path;
          const modEvent = Keymap.isModEvent(evt);
          void app.workspace.openLinkText(path, '', modEvent);
        });

        // Add hover event for file link (use registerDomEvent to ensure cleanup)
        this.registerDomEvent(cardEl, 'mouseover', (evt) => {
          app.workspace.trigger('hover-link', {
            event: evt,
            source: 'bases',
            hoverParent: this,
            targetEl: cardEl,
            linktext: entry.file.path,
          });
        });

        // Create card body for preview
        const cardBodyEl = cardEl.createDiv('bases-card-body');

        // Create card header if user has selected properties
        let cardHeaderEl: HTMLElement | null = null;
        if (visibleProperties.length > 0) {
          cardHeaderEl = cardEl.createDiv('bases-card-header');

          // Display each visible property in the header
          for (const propertyId of visibleProperties) {
            const value = entry.getValue(propertyId);

            // Check if this is the file name property
            if (propertyId === 'file.name') {
              if (value && !(value instanceof NullValue)) {
                // File name: display directly and bold
                const propertyName = cardHeaderEl.createDiv();
                propertyName.className = 'bases-card-property bases-card-file-name';
                value.renderTo(propertyName, app.renderContext);
              }
            } else {
              // Other properties: display name (small) and value (large on new line)
              const propertyContainer = cardHeaderEl.createDiv('bases-card-property');

              // Get display name for this property
              const displayName = this.config.getDisplayName(propertyId);

              // Property name (small font)
              const nameEl = propertyContainer.createDiv('bases-card-property-name');
              nameEl.setText(displayName);

              // Property value (large font, on new line)
              const valueEl = propertyContainer.createDiv('bases-card-property-value');

              // Use isTruthy() to check for meaningful values
              if (value && value.isTruthy()) {
                // All types use the same renderTo() method
                value.renderTo(valueEl, app.renderContext);
                // Add CSS class only for date types (to hide input border)
                if (value instanceof DateValue) {
                  valueEl.addClass('bases-card-date-value');
                }
              } else {
                // Empty value: display '—'
                valueEl.setText('—');
              }
            }
          }
        }

        // Read file content for preview
        void app.vault.read(entry.file).then(content => {
          // Check if there are any images in the content
          const imagePaths = this.getAllImagePaths(content);
          if (imagePaths.length > 0) {
            // Try to display image preview with fallback to markdown
            void this.displayImagePreview(cardBodyEl, imagePaths, content, entry.file.path);
          } else {
            // Create markdown rendered preview
            this.displayMarkdownPreview(cardBodyEl, content, entry.file.path);
          }
        }).catch(() => {
          const previewEl = cardBodyEl.createDiv('bases-card-preview');
          previewEl.setText('Cannot read file content');
        });
      }
    }
  }

  // Helper method to get all image paths from content
  private getAllImagePaths(content: string): string[] {
    // Match Obsidian image links: ![[image.png]]
    const regex = /!\[\[(.*?)\]\]/g;
    const imagePaths: string[] = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
      if (match[1]) {
        imagePaths.push(match[1].trim());
      }
    }
    return imagePaths;
  }

  // Helper method to display markdown preview
  private displayMarkdownPreview(
    cardBodyEl: HTMLElement,
    content: string,
    filePath: string
  ): void {
    const previewEl = cardBodyEl.createDiv('bases-card-markdown-preview');
    // Render markdown content, ignoring frontmatter
    let cleanContent = content;
    const frontmatterMatch = content.match(/^---[\s\S]*?---\n/);
    if (frontmatterMatch) {
      cleanContent = content.replace(frontmatterMatch[0], '');
    }
    // Render markdown to HTML
    void MarkdownRenderer.render(this.app, cleanContent, previewEl, filePath, this);
  }

  // Helper method to display image preview with fallback
  private async displayImagePreview(
    cardBodyEl: HTMLElement,
    imagePaths: string[],
    content: string,
    filePath: string
  ): Promise<void> {
    for (const imagePath of imagePaths) {
      const success = await this.tryLoadImage(cardBodyEl, imagePath);
      if (success) {
        return;
      }
    }
    // If no image was successfully loaded, display markdown preview
    this.displayMarkdownPreview(cardBodyEl, content, filePath);
  }

  // Helper method to try loading a single image
  private async tryLoadImage(
    cardBodyEl: HTMLElement,
    imagePath: string
  ): Promise<boolean> {
    const imageContainerEl = cardBodyEl.createDiv('bases-card-image-container');
    const imgEl = imageContainerEl.createEl('img', 'bases-card-image');

    // Try to get the image file by path only (avoid iterating all files)
    const imageFile = this.app.vault.getAbstractFileByPath(imagePath);

    // Check if it's a file
    if (imageFile && imageFile instanceof TFile) {
      try {
        const arrayBuffer = await this.app.vault.readBinary(imageFile);
        const blob = new Blob([arrayBuffer]);
        const url = URL.createObjectURL(blob);
        // Track created object URLs for cleanup
        this.createdObjectUrls.push(url);
        imgEl.src = url;
        imgEl.alt = 'image preview';
        return true;
      } catch {
        // Image load failed, try next image
        imageContainerEl.remove();
        return false;
      }
    } else {
      // Image not found, try next image
      imageContainerEl.remove();
      return false;
    }
  }

}
