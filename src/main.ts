import {Plugin, BasesView, QueryController, HoverPopover, HoverParent, Keymap, MarkdownRenderer, TFile} from 'obsidian';

export const NotecardsViewType = 'notecards-view';

export default class NotecardsViewPlugin extends Plugin {

	async onload() {
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

  constructor(controller: QueryController, parentEl: HTMLElement) {
    super(controller);
    this.containerEl = parentEl.createDiv('bases-notecards-view-container');
    this.hoverPopover = null;
  }

  public onDataUpdated(): void {
    const { app } = this;

    // Clear entries created by previous iterations
    this.containerEl.empty();

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

        // Get file name
        const fileName = String(entry.file.name).replace(/\.md$/, '');

        // Add click event to open file
        cardEl.onClickEvent((evt) => {
          if (evt.button !== 0 && evt.button !== 1) return;
          evt.preventDefault();
          const path = entry.file.path;
          const modEvent = Keymap.isModEvent(evt);
          void app.workspace.openLinkText(path, '', modEvent);
        });

        // Add hover event for file link
        cardEl.addEventListener('mouseover', (evt) => {
          app.workspace.trigger('hover-link', {
            event: evt,
            source: 'bases',
            hoverParent: this,
            targetEl: cardEl,
            linktext: entry.file.path,
          });
        });

        // Create card header with file name
        const cardHeaderEl = cardEl.createDiv('bases-card-header');
        const titleEl = cardHeaderEl.createDiv('bases-card-title');
        titleEl.setText(fileName);
        
        // Create card body for preview
        const cardBodyEl = cardEl.createDiv('bases-card-body');
        
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

    // Try to get the image file
    let imageFile = this.app.vault.getAbstractFileByPath(imagePath);

    // If not found, try to find by name
    if (!imageFile) {
      const files = this.app.vault.getFiles();
      const foundFile = files.find(file => file.name === imagePath);
      if (foundFile) {
        imageFile = foundFile;
      }
    }

    // Check if it's a file
    if (imageFile && imageFile instanceof TFile) {
      try {
        const arrayBuffer = await this.app.vault.readBinary(imageFile);
        const blob = new Blob([arrayBuffer]);
        const url = URL.createObjectURL(blob);
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
