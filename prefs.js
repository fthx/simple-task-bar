const GObject = imports.gi.GObject;
const Gtk = imports.gi.Gtk;
const Gio = imports.gi.Gio;
const Me = imports.misc.extensionUtils.getCurrentExtension();

function init () {
}

function buildPrefsWidget () {
  let widget = new MyPrefsWidget();
  widget.show_all();
  return widget;
}

const MyPrefsWidget = new GObject.Class({

    Name : "My.Prefs.Widget",
    GTypeName : "MyPrefsWidget",
    Extends : Gtk.Box, // or ScrolledWindow if this gets too big
  
    _init : function (params) {
        // get settings
        let gschema = Gio.SettingsSchemaSource.new_from_directory(
            Me.dir.get_child('schemas').get_path(),
            Gio.SettingsSchemaSource.get_default(),
            false
        );
        this._settings_schema = gschema.lookup('org.gnome.shell.extensions.simple-task-bar', true);
        this.settings = new Gio.Settings({
            settings_schema: this._settings_schema
        });
    
        this.parent(params);
        
        let builder = new Gtk.Builder();
        builder.add_from_file(Me.path + '/prefs.ui');   
    
        this.add( builder.get_object('main_prefs') );

        // bind settings to the UI objects
        let keys = this._settings_schema.list_keys(); // list_keys() is in a "random" order
        for (let i in keys) {
            let key = keys[i]
            // bind setting to property of GUI object (spinboxes, switches, etc...)
            this.settings.bind(
                key,
                builder.get_object(key), // make sure the objects in prefs.ui have the same name as the keys in the settings (schema.xml)
                this._get_bind_property(key),
                Gio.SettingsBindFlags.DEFAULT
            );
        }
    },

    // manually add the keys to the arrays in this function
    _get_bind_property : function (key) {
        let ints = ['hidden-opacity', 'icon-size', 'padding-between-workspaces'];
        let strings = ['sticky-workspace-label', 'custom-workspace-labels'];
        // let bools = ['places-menu-icon', 'remove-activities', 'display-sticky-workspace', 'display-custom-workspaces', 'display-last-workspace', 'display-workspaces', 'use-symbolic-icons', 'show-window-titles'];

        if (ints.includes(key)) {
            return "value"; // spinbox.value
        } else if (strings.includes(key)) {
            return "text"; // entry.text
        } else {
            return "active"; // SHOULD mean bools.includes(key) == true, so switch.active
        }

    }

});

