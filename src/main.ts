import {App, Plugin, BasesView, QueryController, HoverPopover, HoverParent, Keymap, MarkdownRenderer} from 'obsidian';

// Remember to rename these classes and interfaces!
export const NotecardsViewType = 'notecards-view';

export default class NotecardsViewPlugin extends Plugin {

	async onload() {
		// Tell Obsidian about the new view type that this plugin provides.
		this.registerBasesView(NotecardsViewType, {
      		name: 'Notecards',
      		icon: 'lucide-file-text',
      		factory: (controller, containerEl) => new MyBasesView(controller, containerEl),
		// 	options: () => ([
    //     {
    //       type: 'text',
    //       displayName: 'Property separator',
    //       key: 'separator',
    //       default: ' - ',
    //     },
    // ]),
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
        app.vault.read(entry.file).then(content => {
          // Check if there are any images in the content
          const firstImage = this.getFirstImagePath(content);
          if (firstImage) {
            // Display image preview
            this.displayImagePreview(cardBodyEl, firstImage, app);
          } else {
            // Create markdown rendered preview
            const previewEl = cardBodyEl.createDiv('bases-card-markdown-preview');
            // Render markdown content, ignoring frontmatter
            let cleanContent = content;
            const frontmatterMatch = content.match(/^---[\s\S]*?---\n/);
            if (frontmatterMatch) {
              cleanContent = content.replace(frontmatterMatch[0], '');
            }
            // Render markdown to HTML
            MarkdownRenderer.renderMarkdown(cleanContent, previewEl, entry.file.path, this);
          }
        }).catch(err => {
          const previewEl = cardBodyEl.createDiv('bases-card-preview');
          previewEl.setText('cannot read file content');
        });
      }
    }
  }

  // Helper method to get the first image path from content
  private getFirstImagePath(content: string): string | null {
    // Match Obsidian image links: ![[image.png]]
    const imageMatch = content.match(/!\[\[(.*?)\]\]/);
    if (imageMatch && imageMatch[1]) {
      return imageMatch[1].trim();
    }
    return null;
  }

  // Helper method to display image preview
  private displayImagePreview(cardBodyEl: HTMLElement, imagePath: string, app: App): void {
    const imageContainerEl = cardBodyEl.createDiv('bases-card-image-container');
    const imgEl = imageContainerEl.createEl('img', 'bases-card-image');
    
    // Try to get the image file
    let imageFile = app.vault.getAbstractFileByPath(imagePath);
    
    // If not found, try to find by name
    if (!imageFile) {
      const files = app.vault.getFiles();
      const foundFile = files.find(file => file.name === imagePath);
      if (foundFile) {
        imageFile = foundFile;
      }
    }
    
    // Check if it's a file
    if (imageFile && 'extension' in imageFile) {
      // Create a data URL for the image
      app.vault.readBinary(imageFile as any).then(arrayBuffer => {
        const blob = new Blob([arrayBuffer]);
        const url = URL.createObjectURL(blob);
        imgEl.src = url;
        imgEl.alt = 'image preview';
      }).catch(err => {
        const errorEl = imageContainerEl.createDiv('bases-card-preview');
        errorEl.setText('cannot load image');
      });
    } else {
      // If image not found, show text preview
      const errorEl = imageContainerEl.createDiv('bases-card-preview');
      errorEl.setText('image not found');
    }
  }
}
