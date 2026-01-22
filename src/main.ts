import {App, Editor, MarkdownView, Modal, Notice, Plugin, BasesView, QueryController, HoverPopover, HoverParent, Keymap} from 'obsidian';
import {DEFAULT_SETTINGS, MyPluginSettings, SampleSettingTab} from "./settings";

// Remember to rename these classes and interfaces!
export const ExampleViewType = 'example-view';

// Helper function to parse property ID
export function parsePropertyId(propertyId: string): { type: string; name: string } {
  const parts = propertyId.split('.');
  if (parts.length === 2 && parts[0] && parts[1]) {
    return { type: parts[0], name: parts[1] };
  }
  return { type: 'note', name: propertyId };
}

export default class NotesCardPlugin extends Plugin {

	settings: MyPluginSettings;

	async onload() {
		// Load settings
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

		// Add settings tab
		this.addSettingTab(new SampleSettingTab(this.app, this));

		// Tell Obsidian about the new view type that this plugin provides.
		this.registerBasesView(ExampleViewType, {
      		name: 'Example',
      		icon: 'lucide-graduation-cap',
      		factory: (controller, containerEl) => new MyBasesView(controller, containerEl),
			options: () => ([
        {
          // The type of option. 'text' is a text input.
          type: 'text',
          // The name displayed in the settings menu.
          displayName: 'Property separator',
          // The value saved to the view settings.
          key: 'separator',
          // The default value for this option.
          default: ' - ',
        },
    ]),
    	});
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

// Add `implements HoverParent` to enable hovering over file links.
export class MyBasesView extends BasesView implements HoverParent {

  readonly type = ExampleViewType;
  hoverPopover: HoverPopover | null;
  private containerEl: HTMLElement;

  constructor(controller: QueryController, parentEl: HTMLElement) {
    super(controller);
    this.containerEl = parentEl.createDiv('bases-example-view-container');
    this.hoverPopover = null;
  }

  public onDataUpdated(): void {
    const { app } = this;

    // Clear entries created by previous iterations. Remember, you should
    // instead attempt element reuse when possible.
    this.containerEl.empty();

    // Create a card container with grid layout
    const cardContainerEl = this.containerEl.createDiv('bases-card-container');

    // this.data contains both grouped and ungrouped versions of the data.
    // If it's appropriate for your view type, use the grouped form.
    for (const group of this.data.groupedData) {
      // Each entry in the group is a separate file in the vault matching
        // the Base filters. For card view, each entry is a separate card.
        for (const entry of group.entries) {
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
              // Create preview text, limit length
              const previewText = this.getPreviewText(content);
              const previewEl = cardBodyEl.createDiv('bases-card-preview');
              previewEl.setText(previewText);
            }
          }).catch(err => {
            const previewEl = cardBodyEl.createDiv('bases-card-preview');
            previewEl.setText('无法读取文件内容');
          });
          
          // Create card header with file name
          const cardHeaderEl = cardEl.createDiv('bases-card-header');
          const titleEl = cardHeaderEl.createDiv('bases-card-title');
          titleEl.setText(fileName);

          
      }
    }
  }

  // Helper method to get preview text from file content
  private getPreviewText(content: string): string {
    // Remove frontmatter if present
    let cleanContent = content;
    const frontmatterMatch = content.match(/^---[\s\S]*?---\n/);
    if (frontmatterMatch) {
      cleanContent = content.replace(frontmatterMatch[0], '');
    }
    
    // Remove markdown syntax and limit length
    let preview = cleanContent
      .replace(/[#*`~>\[\]()]/g, '') // Remove common markdown syntax
      .replace(/\n+/g, ' ') // Replace newlines with spaces
      .trim();
    
    // Limit preview length
    const maxLength = 150;
    if (preview.length > maxLength) {
      preview = preview.substring(0, maxLength) + '...';
    }
    
    return preview || '无内容';
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
    // First try direct path
    let imageFile = app.vault.getAbstractFileByPath(imagePath);
    
    // If not found, try to find by name (for images in the same folder)
    if (!imageFile) {
      const files = app.vault.getFiles();
      const foundFile = files.find(file => file.name === imagePath);
      if (foundFile) {
        imageFile = foundFile;
      }
    }
    
    // Check if it's a file (using TFile type check)
    if (imageFile && 'extension' in imageFile) {
      // Create a data URL for the image
      app.vault.readBinary(imageFile as any).then(arrayBuffer => {
        const blob = new Blob([arrayBuffer]);
        const url = URL.createObjectURL(blob);
        imgEl.src = url;
        imgEl.alt = '预览图片';
      }).catch(err => {
        const errorEl = imageContainerEl.createDiv('bases-card-preview');
        errorEl.setText('无法加载图片');
      });
    } else {
      // If image not found, show text preview
      const errorEl = imageContainerEl.createDiv('bases-card-preview');
      errorEl.setText('图片未找到');
    }
  }
}
