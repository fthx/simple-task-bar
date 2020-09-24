/* 
	Simple Task Bar
	Copyright Francois Thirioux 2020
	GitHub contributors: @fthx (original extension), @leleat (more settings, settings UI)
	License GPL v3
*/

const Lang = imports.lang;
const St = imports.gi.St;
const Main = imports.ui.main;
const Util = imports.misc.util;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const Clutter = imports.gi.Clutter;
const AppMenu = Main.panel.statusArea.appMenu;
const PopupMenu = imports.ui.popupMenu;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Me = imports.misc.extensionUtils.getCurrentExtension();

// translation needed to restore Places Menu label when disable extension
const Gettext = imports.gettext.domain('gnome-shell-extensions');
const _ = Gettext.gettext;
const N_ = x => x;


const WindowList = new Lang.Class({
	Name: 'WindowList.WindowList',
	
	// create the task bar container and signals
	_init: function(){
		// get settings
		let gschema = Gio.SettingsSchemaSource.new_from_directory(
			Me.dir.get_child('schemas').get_path(),
			Gio.SettingsSchemaSource.get_default(),
			false
		);
		this.settings_schema = gschema.lookup('org.gnome.shell.extensions.simple-task-bar', true);
		this.settings = new Gio.Settings({
			settings_schema: this.settings_schema
		});

		// signals for settings change
		let keys = this.settings_schema.list_keys();
		this.signals_array = [];
		for (let i in keys) {
			let key = keys[i];
			if (key == "remove-activities") {
				this.signals_array[i] = this.settings.connect( "changed::" + key, this._set_Activities_visibility.bind(this) );
			} else if (key == "places-menu-icon") {
				this.signals_array[i] = this.settings.connect( "changed::" + key, this._set_Places_to_icon.bind(this) );
			} else {
				this.signals_array[i] = this.settings.connect( "changed::" + key, this._updateMenu.bind(this) );
			}
		}

		if (this.settings.get_boolean("remove-activities")) {
			this._set_Activities_visibility();
		};

		if (this.settings.get_boolean("places-menu-icon")) {
			this._set_Places_to_icon();
		};
	
		this.apps_menu = new St.BoxLayout({});
		this.actor = this.apps_menu;
        this._updateMenu();
		this._restacked = global.display.connect('restacked', Lang.bind(this, this._updateMenu));
		this._window_change_monitor = global.display.connect('window-left-monitor', Lang.bind(this, this._updateMenu));
		this._workspace_changed = global.workspace_manager.connect('active-workspace-changed', Lang.bind(this, this._updateMenu));
		this._workspace_number_changed = global.workspace_manager.connect('notify::n-workspaces', Lang.bind(this, this._updateMenu));
	},

	// destroy the task bar
	_destroy: function() {
		if (this.settings.get_boolean("remove-activities")) {
			this._set_Activities_visibility(true);
		};

		if (this.settings.get_boolean("places-menu-icon")) {
			this._set_Places_to_icon(true);
		};

		// disconnect all signals
		global.display.disconnect(this._restacked);
		global.display.disconnect(this._window_change_monitor);
		global.workspace_manager.disconnect(this._workspace_changed);
		global.workspace_manager.disconnect(this._workspace_number_changed);

		// disconnect signals for settings change
		this.signals_array.forEach(signalID => this.settings.disconnect(signalID));
		
		// destroy task bar container
		this.apps_menu.destroy();
	},
	
	// hide Activities button
	_set_Activities_visibility: function(extension_disabled) {
		if ( (extension_disabled == true && this.settings.get_boolean("remove-activities")) || !this.settings.get_boolean("remove-activities") ) {
			let activities_indicator = Main.panel.statusArea['activities'];
			if (activities_indicator && !Main.sessionMode.isLocked) {
				activities_indicator.container.show();
			}
		} else {
			let activities_indicator = Main.panel.statusArea['activities'];
			if (activities_indicator) {
				activities_indicator.container.hide();
			}
		}
	},

	// change Places label to folder icon or restore label
	_set_Places_to_icon: function(extension_disabled) {
		let places_menu_indicator = Main.panel.statusArea['places-menu'];
		if (places_menu_indicator) {
			places_menu_indicator.remove_child(places_menu_indicator.get_first_child());
			let places_menu_box = new St.BoxLayout({style_class: 'panel-status-menu-box'});

			if ( (extension_disabled == true && this.settings.get_boolean("places-menu-icon")) || !this.settings.get_boolean("places-menu-icon") ) {
				let places_menu_label = new St.Label({
					text: _('Places'),
					y_expand: true,
					y_align: Clutter.ActorAlign.CENTER,
				});
				places_menu_box.add_child(places_menu_label);
				places_menu_box.add_child(PopupMenu.arrowIcon(St.Side.BOTTOM));
				places_menu_indicator.add_actor(places_menu_box);
			} else {
				let places_menu_icon = new St.Icon({ icon_name: 'folder-symbolic', style_class: 'system-status-icon' });
				places_menu_box.add_child(places_menu_icon);
				places_menu_box.add_child(PopupMenu.arrowIcon(St.Side.BOTTOM));
				places_menu_indicator.add_actor(places_menu_box);
			}
		}
	},

	// update the task bar
    _updateMenu: function() {   
    	// destroy old task bar 	
    	this.apps_menu.destroy_all_children();
    	
		// update the focused window title
    	this._updateTitle();
    	
    	// track windows and get the number of workspaces
        this.tracker = Shell.WindowTracker.get_default();
        this.workspaces_count = global.workspace_manager.get_n_workspaces();
		
		// do this for all existing workspaces
		if (this.settings.get_boolean("display-last-workspace")) {
			this.last_workspace = this.workspaces_count
		} else {
			this.last_workspace = this.workspaces_count - 1
		};
        for (let workspace_index = 0; workspace_index < this.last_workspace; ++workspace_index) {
        
            let metaWorkspace = global.workspace_manager.get_workspace_by_index(workspace_index);
            this.windows = metaWorkspace.list_windows().sort(this._sortWindows);
            
            // create sticky workspace icon + all sticky windows (on all workspaces) icons and buttons
            if (workspace_index == 0) {
            	this.sticky_windows = this.windows.filter(
            		function(w) {
                		return !w.is_skip_taskbar() && w.is_on_all_workspaces();
            		}
            	);
            	
				if (this.settings.get_boolean("display-sticky-workspace")) {
				    if (this.sticky_windows.length > 0) {
						this.allws_box = new St.Bin({visible: true, 
											reactive: true, can_focus: true, track_hover: true});						
						this.allws_box.label = new St.Label({y_align: Clutter.ActorAlign.CENTER});
						this.allws_box.label.style_class = 'desk-label-active';
						this.allws_box.label.set_text((" " + this.settings.get_string("sticky-workspace-label") + " ").toString());
						this.allws_box.set_child(this.allws_box.label);
						this.apps_menu.add_actor(this.allws_box);
				    };
				};			
				
            	for ( let i = 0; i < this.sticky_windows.length; ++i ) {
	            	let metaWindow = this.sticky_windows[i];
	            	let box = new St.Bin({visible: true, 
        						reactive: true, can_focus: true, track_hover: true});
	            	box.window = this.sticky_windows[i];
	           		box.window.connect("notify::title", this._updateTitle.bind(this));
	            	box.tooltip = box.window.get_title();
	            	box.app = this.tracker.get_window_app(box.window);
		            box.connect('button-press-event', Lang.bind(this, function() {
		            							this._activateWindow(metaWorkspace, metaWindow); } ));
		            box.icon = box.app.create_icon_texture(this.settings.get_int("icon-size"));
		            let iconEffect = new Clutter.DesaturateEffect();
                	box.icon.add_effect(iconEffect);
		            if (metaWindow.is_hidden()) {
						box.icon.set_opacity(this.settings.get_int("hidden-opacity")); box.style_class = 'hidden-app';
		            }
		            else {
		            	 if (metaWindow.has_focus()) {box.style_class = 'focused-app';}
		            	 else {box.style_class = 'unfocused-app';}
		            };
		           	box.set_child(box.icon);
		           	box.connect('notify::hover', Lang.bind(this, function() {
		            							this._onHover(box, box.tooltip); } ));
		            this.apps_menu.add_actor(box);
            	}
            };
            
            // create all workspaces labels and buttons
            if (this.settings.get_boolean("display-workspaces")) {
		    	this.ws_box = new St.Bin({visible: true, 
								reactive: true, can_focus: true, track_hover: true});
				this.ws_box.label = new St.Label({y_align: Clutter.ActorAlign.CENTER});
		    	if (global.workspace_manager.get_active_workspace() === metaWorkspace) {
					this.ws_box.label.style_class = 'desk-label-active';
				}
				else {
					this.ws_box.label.style_class = 'desk-label-inactive';
				};
				let custom_ws_labels = this.settings.get_string("custom-workspace-labels").split(",");
				if (this.settings.get_boolean("display-custom-workspaces") && workspace_index < custom_ws_labels.length) {
					this.ws_box.label.set_text((" " + custom_ws_labels[workspace_index].trim() + " ").toString());
				} else {
					this.ws_box.label.set_text((" " + (workspace_index+1) + " ").toString());
				};
				this.ws_box.set_child(this.ws_box.label);
				this.ws_box.connect('button-press-event', Lang.bind(this, function() {
		        							this._activateWorkspace(metaWorkspace); } ));
		        this.apps_menu.add_actor(this.ws_box);
		    	
		    	this.windows = this.windows.filter(
		        	function(w) {
		            	return !w.is_skip_taskbar() && !w.is_on_all_workspaces();
		           	}
		        );
		    };
			
			// create all normal windows icons and buttons
            for ( let i = 0; i < this.windows.length; ++i ) {
	            let metaWindow = this.windows[i];
	            let box = new St.Bin({visible: true, 
        						reactive: true, can_focus: true, track_hover: true});
	            box.window = this.windows[i];
	            box.window.connect("notify::title", this._updateTitle.bind(this));
	            box.tooltip = box.window.get_title();
	            box.app = this.tracker.get_window_app(box.window);
                box.connect('button-press-event', Lang.bind(this, function() {
                							this._activateWindow(metaWorkspace, metaWindow); } ));
                box.icon = box.app.create_icon_texture(this.settings.get_int("icon-size"));
                let iconEffect = new Clutter.DesaturateEffect();
                box.icon.add_effect(iconEffect);
                if (metaWindow.is_hidden()) {
					box.icon.set_opacity(this.settings.get_int("hidden-opacity")); box.style_class = 'hidden-app';
                }
                else {
                	 if (metaWindow.has_focus()) {box.style_class = 'focused-app';}
                	 else {box.style_class = 'unfocused-app';}
                };
               	box.set_child(box.icon);
               	box.connect('notify::hover', Lang.bind(this, function() {
                							this._onHover(box, box.tooltip); } ));
                this.apps_menu.add_actor(box);
            };
        };
    },

	// windows list sort function by window id
    _sortWindows: function(w1, w2) {
    	return w1.get_id() - w2.get_id();
    },
    
	// displays the focused window title
	_updateTitle: function() {
		if (global.display.get_focus_window()) {
			this.window_label = global.display.get_focus_window().get_title();
			if (this.window_label) {
				AppMenu._label.set_text(this.window_label);
			}
		};
	},
    
    // hover on app icon button b shows its window title tt
    _onHover: function(b, tt) {
    	if (tt && b.hover) {
    		AppMenu._label.set_text(tt);
    	} else {
    		this._updateTitle();
    	};
    },
    
    // activate workspace ws
    _activateWorkspace: function(ws) {
		if (global.workspace_manager.get_active_workspace() === ws) {
			Main.overview.toggle();
		}
		else {
			Main.overview.show();
		};
		ws.activate(global.get_current_time());
    },

	// switch to workspace ws and activate window w
    _activateWindow: function(ws, w) {
        if (global.workspace_manager.get_active_workspace() === ws && w.has_focus() 
        												&& !(Main.overview.visible)) {
       		w.minimize();
       	}
        else {	
        	//w.unminimize();
			//w.unshade(global.get_current_time());
			w.activate(global.get_current_time());
		};
		Main.overview.hide();
		if (!(w.is_on_all_workspaces())) { ws.activate(global.get_current_time()); };
    }

});

let windowlist;

function init() {
}

function enable() {
    // activate and display task bar in the panel
	windowlist = new WindowList;
    let position = 1;
    if ('places-menu' in Main.panel.statusArea)
        position++;
    Main.panel._leftBox.insert_child_at_index(windowlist.actor, position);

	// hide icon before the AppMenu label
	AppMenu._iconBox.hide();

}

function disable() {
	// destroy task bar
	windowlist._destroy();

	// restore default AppMenu label
	AppMenu._iconBox.show();
}
