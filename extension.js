/* 
	Simple Task Bar
	Copyright fthx 2020
	License: GPL v3
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

const Gettext = imports.gettext.domain('gnome-shell-extensions');
const _ = Gettext.gettext;
const N_ = x => x;

var ICON_SIZE = 22;
var HIDDEN_OPACITY = 127;


const WindowList = new Lang.Class({
	Name: 'WindowList.WindowList',

	_init: function(){	
		AppMenu._iconBox.hide();
	
		this.apps_menu = new St.BoxLayout({});
		this.actor = this.apps_menu;
        this._updateMenu();
		this._restacked = global.display.connect('restacked', Lang.bind(this, this._updateMenu));
		this._window_change_monitor = global.display.connect('window-left-monitor', Lang.bind(this, this._updateMenu));
		this._workspace_removed = global.workspace_manager.connect('workspace-removed', Lang.bind(this, this._updateMenu));
		this._workspace_changed = global.workspace_manager.connect('active-workspace-changed', Lang.bind(this, this._updateMenu));
		this._workspace_added = global.workspace_manager.connect('workspace-added', Lang.bind(this, this._updateMenu));
		this._workspace_number_changed = global.workspace_manager.connect('notify::n-workspaces', Lang.bind(this, this._updateMenu));
	},

	_destroy: function() {
		global.display.disconnect(this._restacked);
		global.display.disconnect(this._window_change_monitor);
		global.workspace_manager.disconnect(this._workspace_removed);
		global.workspace_manager.disconnect(this._workspace_changed);
		global.workspace_manager.disconnect(this._workspace_added);
		global.workspace_manager.disconnect(this._workspace_number_changed);
		this.apps_menu.destroy();
    },

    _updateMenu: function() {    	
    	this.apps_menu.destroy_all_children();
    	
    	this._updateTitle();
    
        this.tracker = Shell.WindowTracker.get_default();
        this.workspaces_count = global.workspace_manager.get_n_workspaces();

        for ( let workspace_index = 0; workspace_index < this.workspaces_count; ++workspace_index ) {
        
            let metaWorkspace = global.workspace_manager.get_workspace_by_index(workspace_index);
            this.windows = metaWorkspace.list_windows();
            
            if (workspace_index==0) {
            	this.sticky_windows = this.windows.filter(
            		function(w) {
                		return !w.is_skip_taskbar() && w.is_on_all_workspaces();
            		}
            	);
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
            
        	this.ws_box = new St.Bin({visible: true, 
    						reactive: true, can_focus: true, track_hover: true});
    		this.ws_box.label = new St.Label({y_align: Clutter.ActorAlign.CENTER});
        	if (global.workspace_manager.get_active_workspace() === metaWorkspace) {
    			this.ws_box.label.style_class = 'desk-label-active';
    		}
    		else {
    			this.ws_box.label.style_class = 'desk-label-inactive';
    		};
    		this.ws_box.label.set_text((" "+(workspace_index+1)+" ").toString());
    		this.ws_box.set_child(this.ws_box.label);
    		this.ws_box.connect('button-press-event', Lang.bind(this, function() {
            							this._activateWorkspace(metaWorkspace); } ));
            this.apps_menu.add_actor(this.ws_box);
        	
        	this.windows = this.windows.filter(
            	function(w) {
                	return !w.is_skip_taskbar() && !w.is_on_all_workspaces();
               	}
            );

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
    
    _updateTitle: function() {
    	if (global.display.get_focus_window()) {
    			AppMenu._label.set_text(global.display.get_focus_window().get_title());
    		};
    },
    
    _onHover: function(b, tt) {
    	if (b.hover) {
    		AppMenu._label.set_text(tt);
    	} else {
    		this._updateTitle();
    	};
    },
    
    _activateWorkspace: function(ws) {
		if (global.workspace_manager.get_active_workspace() === ws) {
			Main.overview.toggle();
		}
		else {
			Main.overview.show();
		};
		ws.activate(global.get_current_time());
    },

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
    },

     _onButtonPress: function(actor, event) {
     	this._updateMenu();
     	this.parent(actor, event);
    },

});

let windowlist;

function init() {
}

function enable() {
	let activities_indicator = Main.panel.statusArea['activities'];
	if (activities_indicator) {
    	activities_indicator.hide();
	};
	
	let places_menu_indicator = Main.panel.statusArea['places-menu'];
	if (places_menu_indicator) {
    	places_menu_indicator.remove_child(places_menu_indicator.get_first_child());
    	let places_menu_box = new St.BoxLayout({style_class: 'panel-status-menu-box'});
       	let places_menu_icon = new St.Icon({ icon_name: 'folder-symbolic', style_class: 'system-status-icon' });
       	places_menu_box.add_child(places_menu_icon);
       	places_menu_box.add_child(PopupMenu.arrowIcon(St.Side.BOTTOM));
       	places_menu_indicator.add_actor(places_menu_box);
	};
    	
	windowlist = new WindowList;
    let position = 1;
    if ('places-menu' in Main.panel.statusArea)
        position++;
    Main.panel._leftBox.insert_child_at_index(windowlist.actor, position);

}

function disable() {
	windowlist._destroy();
	AppMenu._iconBox.show();
	
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
	
	let activities_indicator = Main.panel.statusArea['activities'];
	if (activities_indicator) {
    	activities_indicator.show();
    };
}
