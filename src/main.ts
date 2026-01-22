import {App, Editor, MarkdownView, Modal, Notice, Plugin, BasesView, QueryController} from 'obsidian';
import {DEFAULT_SETTINGS, MyPluginSettings, SampleSettingTab} from "./settings";

// Remember to rename these classes and interfaces!
export const ExampleViewType = 'example-view';

export default class NotesCardPlugin extends Plugin {

	async onload() {
		// Tell Obsidian about the new view type that this plugin provides.
		this.registerBasesView(ExampleViewType, {
      		name: 'Example',
      		icon: 'lucide-graduation-cap',
      		factory: (controller, containerEl) => new MyBasesView(controller, containerEl),
    	});
	}
}

export class MyBasesView extends BasesView {
  readonly type = ExampleViewType;
  private containerEl: HTMLElement;

  constructor(controller: QueryController, parentEl: HTMLElement) {
    super(controller);
    this.containerEl = parentEl.createDiv('bases-example-view-container');
  }

  // onDataUpdated is called by Obsidian whenever there is a configuration
  // or data change in the vault which may affect your view. For now,
  // simply draw "Hello World" to screen.
  public onDataUpdated(): void {
    this.containerEl.empty();
    this.containerEl.createDiv({ text: 'Hello World' });
  }
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		let {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

