/* 
	Simple Task Bar
	Copyright fthx 2020
	License GPL v3
*/


// ********************  USER SETTINGS  *********************************************

// icon size for apps in task bar (px, default = 20)
var ICON_SIZE = 20;

// opacity of inactive or hidden windows (min = 0, max = 255, default = 127)
var HIDDEN_OPACITY = 127;

// display workspaces labels (true or false, default = true)
var DISPLAY_WORKSPACES = true

// display last void workspace label (true or false, default = true)
var DISPLAY_LAST_WORKSPACE = true

// display custom workspaces labels (true or false, default = false)
var DISPLAY_CUSTOM_WORKSPACES = false

// display workspace label for sticky display (2nd monitor, ...) label (true or false, default = true)
var DISPLAY_STICKY_WORKSPACE = true

// custom workspaces labels (string list, as long as needed, no bug if list is too short)
var CUSTOM_WORKSPACES_LABELS = ["A", "BB", "CCC", "DDDD"]

// sticky workspace label (string, default = "0")
var STICKY_WORKSPACE_LABEL = "0"

// remove Activities button (true or false, default = true)
var REMOVE_ACTIVITIES = true

// change Places Menu label to an icon (true or false, default = true)
var PLACES_MENU_ICON = true

// if true, show the complete title of the focused window else only show the app name (true or false, default = true)
var SHOW_WINDOW_TITLE = true;

// **********************************************************************************


const Lang = imports.lang;
const St = imports.gi.St;
const Main = imports.ui.main;
const Util = imports.misc.util;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const Clutter = imports.gi.Clutter;
const AppMenu = Main.panel.statusArea.appMenu;
const PopupMenu = imports.ui.popupMenu;

// translation needed to restore Places Menu label when disable extension
const Gettext = imports.gettext.domain('gnome-shell-extensions');
const _ = Gettext.gettext;
const N_ = x => x;


const WindowList = new Lang.Class({
	Name: 'WindowList.WindowList',
	
	// create the task bar container and signals
	_init: function(){
	
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
		// disconnect all signals
		global.display.disconnect(this._restacked);
		global.display.disconnect(this._window_change_monitor);
		global.workspace_manager.disconnect(this._workspace_changed);
		global.workspace_manager.disconnect(this._workspace_number_changed);
		
		// destroy task bar container
		this.apps_menu.destroy();
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
		if (DISPLAY_LAST_WORKSPACE) {
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
            	
            	if (DISPLAY_STICKY_WORKSPACE) {
				    if (this.sticky_windows.length > 0) {
						this.allws_box = new St.Bin({visible: true, 
											reactive: true, can_focus: true, track_hover: true});						
						this.allws_box.label = new St.Label({y_align: Clutter.ActorAlign.CENTER});
						this.allws_box.label.style_class = 'desk-label-active';
						this.allws_box.label.set_text((" " + STICKY_WORKSPACE_LABEL + " ").toString());
						this.allws_box.set_child(this.allws_box.label);
						this.apps_menu.add_actor(this.allws_box);
				    };
				};			
				
            	for ( let i = 0; i < this.sticky_windows.length; ++i ) {
	            	let metaWindow = this.sticky_windows[i];
	            	let box = new St.Bin({visible: true, 
        						reactive: true, can_focus: true, track_hover: true});
	            	box.window = this.sticky_windows[i];
	           		box.window.connect("notify::title", this._updateTitle);
	            	box.tooltip = box.window.get_title();
	            	box.app = this.tracker.get_window_app(box.window);
		            box.connect('button-press-event', Lang.bind(this, function() {
		            							this._activateWindow(metaWorkspace, metaWindow); } ));
		            box.icon = box.app.create_icon_texture(ICON_SIZE);
		            if (metaWindow.is_hidden()) {
		            	box.icon.set_opacity(HIDDEN_OPACITY); box.style_class = 'hidden-app';
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
            if (DISPLAY_WORKSPACES) {
		    	this.ws_box = new St.Bin({visible: true, 
								reactive: true, can_focus: true, track_hover: true});
				this.ws_box.label = new St.Label({y_align: Clutter.ActorAlign.CENTER});
		    	if (global.workspace_manager.get_active_workspace() === metaWorkspace) {
					this.ws_box.label.style_class = 'desk-label-active';
				}
				else {
					this.ws_box.label.style_class = 'desk-label-inactive';
				};
				if (DISPLAY_CUSTOM_WORKSPACES && workspace_index < CUSTOM_WORKSPACES_LABELS.length) {
					this.ws_box.label.set_text((" "+CUSTOM_WORKSPACES_LABELS[workspace_index]+" ").toString());
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
	            box.window.connect("notify::title", this._updateTitle);
	            box.tooltip = box.window.get_title();
	            box.app = this.tracker.get_window_app(box.window);
                box.connect('button-press-event', Lang.bind(this, function() {
                							this._activateWindow(metaWorkspace, metaWindow); } ));
                box.icon = box.app.create_icon_texture(ICON_SIZE);
                if (metaWindow.is_hidden()) {
                	box.icon.set_opacity(HIDDEN_OPACITY); box.style_class = 'hidden-app';
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
			if (SHOW_WINDOW_TITLE) {
				this.window_label = global.display.get_focus_window().get_title();
			} else {
				// only show app name
				if (this.tracker && this.tracker.get_window_app(global.display.get_focus_window())) {
					this.window_label = this.tracker.get_window_app(global.display.get_focus_window()).get_name();
				}
			}
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
	// hide icon before the AppMenu label
	AppMenu._iconBox.hide();
	
	// hide Activities label
	if (REMOVE_ACTIVITIES) {
		let activities_indicator = Main.panel.statusArea['activities'];
		if (activities_indicator) {
			activities_indicator.container.hide();
		};
	};
	
	// change Places label to folder icon
	if (PLACES_MENU_ICON) {
		let places_menu_indicator = Main.panel.statusArea['places-menu'];
		if (places_menu_indicator) {
			places_menu_indicator.remove_child(places_menu_indicator.get_first_child());
			let places_menu_box = new St.BoxLayout({style_class: 'panel-status-menu-box'});
		   	let places_menu_icon = new St.Icon({ icon_name: 'folder-symbolic', style_class: 'system-status-icon' });
		   	places_menu_box.add_child(places_menu_icon);
		   	places_menu_box.add_child(PopupMenu.arrowIcon(St.Side.BOTTOM));
		   	places_menu_indicator.add_actor(places_menu_box);
		};
	};
    	
    // activate and display task bar in the panel
	windowlist = new WindowList;
    let position = 1;
    if ('places-menu' in Main.panel.statusArea)
        position++;
    Main.panel._leftBox.insert_child_at_index(windowlist.actor, position);

}

function disable() {
	// destroy task bar
	windowlist._destroy();
	
	// restore default AppMenu label
	AppMenu._iconBox.show();
	
	// display Places label instead of icon
	if (PLACES_MENU_ICON) {
		let places_menu_indicator = Main.panel.statusArea['places-menu'];
		if (places_menu_indicator) {
			places_menu_indicator.remove_child(places_menu_indicator.get_first_child());
			let places_menu_box = new St.BoxLayout({style_class: 'panel-status-menu-box'});
		   	let places_menu_label = new St.Label({
		        text: _('Places'),
		        y_expand: true,
		        y_align: Clutter.ActorAlign.CENTER,
		    });
		   	places_menu_box.add_child(places_menu_label);
		   	places_menu_box.add_child(PopupMenu.arrowIcon(St.Side.BOTTOM));
		   	places_menu_indicator.add_actor(places_menu_box);
		};
	};
	
	// display Activities label ; take care of locked session to not display Activities label on it
	if (REMOVE_ACTIVITIES) {
		let activities_indicator = Main.panel.statusArea['activities'];
		if (activities_indicator && !Main.sessionMode.isLocked) {
			activities_indicator.container.show();
		};
	}
}
