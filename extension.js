/* Simple Task Bar
   Copyright fthx 2020
   License: GPL v3
   Contains some code from All Windows extension by lyonel
*/

const Lang = imports.lang;
const St = imports.gi.St;
const Main = imports.ui.main;
//const Panel = imports.ui.panel;
const Meta = imports.gi.Meta;
const Shell = imports.gi.Shell;
const Clutter = imports.gi.Clutter;

const ICON_SIZE = 22;
const HIDDEN_OPACITY = 127;


const WindowList = new Lang.Class({
	Name: 'WindowList.WindowList',

	_init: function(){
		this.apps_menu = new St.BoxLayout({});
		this.actor = this.apps_menu;
        this._updateMenu();
		this._restacked = global.display.connect('restacked', Lang.bind(this, this._updateMenu));
		this._window_change_monitor = global.display.connect('window-left-monitor', Lang.bind(this, this._updateMenu));
		this._workspace_removed = global.workspace_manager.connect('workspace-removed', Lang.bind(this, this._updateMenu));
	},

	_destroy: function() {
		global.display.disconnect(this._restacked);
		global.display.disconnect(this._window_change_monitor);
		global.workspace_manager.disconnect(this._workspace_removed);
		this.apps_menu.destroy();
    },

    _updateMenu: function() {
    	this.apps_menu.destroy_all_children();
    
        this.tracker = Shell.WindowTracker.get_default();
        this.workspaces_count = global.workspace_manager.n_workspaces;

        for ( let workspace_index=0; workspace_index<this.workspaces_count; ++workspace_index ) {
        
            //this.workspace_name = Meta.prefs_get_workspace_name(workspace_index);
            let metaWorkspace = global.workspace_manager.get_workspace_by_index(workspace_index);
            this.windows = metaWorkspace.list_windows();
            
            this.sticky_windows = this.windows.filter(
            	function(w) {
                	return !w.is_skip_taskbar() && w.is_on_all_workspaces();
            	}
            );
            
            this.windows = this.windows.filter(
            	function(w) {
                	return !w.is_skip_taskbar() && !w.is_on_all_workspaces();
               	}
            );
            
            if(this.sticky_windows.length > 0 && workspace_index==0) {
                for ( let i = 0; i < this.sticky_windows.length; ++i ) {
                    let metaWindow = this.sticky_windows[i];
					this.box = new St.Bin({visible: true, 
        							reactive: true, can_focus: true, track_hover: true});
					this.box.window = this.sticky_windows[i];
					this.app = this.tracker.get_window_app(this.box.window);
                	this.box.connect('button-press-event', Lang.bind(this, function() {
                							this._activateWindow(metaWorkspace, metaWindow); } ));
                	this.box.icon = this.app.create_icon_texture(ICON_SIZE);
                	if (metaWindow.is_hidden()) {
                		this.box.icon.set_opacity(HIDDEN_OPACITY); this.box.style_class = 'hidden-app';
                	}
                	else {
                	 	if (metaWindow.has_focus()) {this.box.style_class = 'focused-app';}
                	 	else {this.box.style_class = 'unfocused-app';}
                	};
               		this.box.set_child(this.box.icon);
                	this.apps_menu.add_actor(this.box);
                }
            }
            
            if (this.windows.length > 0) {
            	if (global.workspace_manager.get_active_workspace() === metaWorkspace) {
        			this.workspace_label = new St.Label({style_class: 'desk-label-active',
        											y_align: Clutter.ActorAlign.CENTER});
        			this.workspace_label.set_text((" "+(workspace_index+1)+" ").toString());
        			this.apps_menu.add_actor(this.workspace_label);}
        		else {
        			this.workspace_label = new St.Label({style_class: 'desk-label-inactive',
        											y_align: Clutter.ActorAlign.CENTER});
        			this.workspace_label.set_text((" "+(workspace_index+1)+" ").toString());
        			this.apps_menu.add_actor(this.workspace_label);};
        	};

            for ( let i = 0; i < this.windows.length; ++i ) {
	            let metaWindow = this.windows[i];
	            this.box = new St.Bin({visible: true, 
        						reactive: true, can_focus: true, track_hover: true});
	            this.box.window = this.windows[i];
	            this.app = this.tracker.get_window_app(this.box.window);
                this.box.connect('button-press-event', Lang.bind(this, function() {
                							this._activateWindow(metaWorkspace, metaWindow); } ));
                this.box.icon = this.app.create_icon_texture(ICON_SIZE);
                if (metaWindow.is_hidden()) {
                	this.box.icon.set_opacity(HIDDEN_OPACITY); this.box.style_class = 'hidden-app';
                }
                else {
                	 if (metaWindow.has_focus()) {this.box.style_class = 'focused-app';}
                	 else {this.box.style_class = 'unfocused-app';}
                };
               	this.box.set_child(this.box.icon);
                this.apps_menu.add_actor(this.box);
            }
        }
    },

    _activateWindow: function(ws, w) {
        if (global.workspace_manager.get_active_workspace() === ws && w.has_focus()) {
       		w.minimize();
       	}
        else {	
        		w.unminimize();
				w.unshade(global.get_current_time());
				w.activate(global.get_current_time());
		};
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
	windowlist = new WindowList;
    let position = 1;
    if ('places-menu' in Main.panel.statusArea)
        position++;
    Main.panel._leftBox.insert_child_at_index(windowlist.actor, position);

}

function disable() {
	windowlist._destroy();
}
