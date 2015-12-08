/*global require,setTimeout*/
var classes = require("../submodules/node-homeseer/src/hs-classes.js");
var myq = require("../submodules/node-liftmaster/liftmaster.js");
var garage;
var store = require("jfs");
var db = new store("myq-cfg");

var hs = new classes.Homeseer("ws://pi.nine.ms:8087/homeseer");
var devs = [];
var Device = classes.Device;

function myqId(id)
{
    var idx = id.lastIndexOf("-");
    if (idx !== -1)
        return id.substr(idx + 1);
    return "";
}

function checkValue(dev, timeout)
{
    // keep checking while the door is opening or closing
    if (timeout === undefined)
        timeout = 10000;
    setTimeout(function() {
        garage.getDoorState(myqId(dev.id), function(err, state) {
            if (err)
                throw err;
            dev.value = parseInt(state.state);
            dev.text = statusText[dev.value];
            if (dev.value > 2)
                checkValue(dev);
        });
    }, timeout);
}

function checkStatus(dev)
{
    setTimeout(function() {
        garage.getDoorState(myqId(dev.id), function(err, state) {
            if (err)
                throw err;
            console.log("updated " + state);
            dev.value = parseInt(state.state);
            dev.text = statusText[dev.value];
            checkStatus(dev);
        });
    }, 5 * 60 * 1000);
}

function dryRun(id, value, cb)
{
    console.log("dry run with " + id);
    setTimeout(function() {
        cb(null, { id: id, state: value });
    }, 100);
}

function deviceValueChanged(dev)
{
    var device = dev.device;
    if (dev.value !== undefined) {
        console.log("setting state " + dev.value);
        // garage.setDoorState(myqId(device.id), "" + dev.value, function(err, state) {
        //     if (err) {
        //         console.log(err);
        //         throw err;
        //     }
        //     device.value = parseInt(state.state);
        //     device.text = statusText[dev.value];
        //     checkValue(device, 1000);
        // });
        dryRun(myqId(device.id), "" + dev.value, function(err, state) {
            if (err) {
                console.log(err);
                throw err;
            }
            device.value = parseInt(state.state);
            device.text = statusText[dev.value];
            checkValue(device, 1000);
        });
    }
}

var statusText = {
    1: "Open",
    2: "Closed",
    4: "Opening",
    5: "Closing"
};

function createDevices(devices) {
    var hsdevs = [];
    for (var i = 0; i < devices.length; ++i) {
        var dev = devices[i];
        hsdevs.push({
            name: dev.name,
            location: "Garage",
            location2: "1st floor",
            type: "type",
            address: "myq",
            code: "" + dev.id,
            pairs: [
                {
                    status: {
                        //type: "single",
                        value: 1,
                        text: "Open",
                        control: Device.StatusControl.Status | Device.StatusControl.Control,
                        use: Device.Use.Off,
                        render: Device.Render.Button,
                        //buttonImage: "",
                        includeValues: false
                    },
                    graphic: {
                        value: 1,
                        graphic: "images/checkbox_on.png"
                    }
                },
                {
                    status: {
                        //type: "single",
                        value: 2,
                        text: "Close",
                        control: Device.StatusControl.Status | Device.StatusControl.Control,
                        use: Device.Use.On,
                        render: Device.Render.Button,
                        //buttonImage: "",
                        includeValues: false
                    },
                    graphic: {
                        value: 2,
                        graphic: "images/checkbox_off.png"
                    }
                },
                {
                    status: {
                        //type: "single",
                        value: 4,
                        text: "Opening",
                        control: Device.StatusControl.Status,
                        //render: Device.Render.Values,
                        //buttonImage: "",
                        includeValues: false
                    },
                    graphic: {
                        value: 4,
                        graphic: "images/checkbox_off.png"
                    }
                },
                {
                    status: {
                        //type: "single",
                        value: 5,
                        text: "Closing",
                        control: Device.StatusControl.Status,
                        //render: Device.Render.Values,
                        //buttonImage: "",
                        includeValues: false
                    },
                    graphic: {
                        value: 5,
                        graphic: "images/checkbox_off.png"
                    }
                }

            ]
        });
    }
    hs.addDevices(hsdevs, function(newdevs) {
        for (var i = 0; i < newdevs.length; ++i) {
            var d = newdevs[i];
            garage.getDoorState(myqId(d.id), function(err, state) {
                if (err)
                    throw err;
                d.value = parseInt(state.state);
                d.text = statusText[d.value];
                checkStatus(d);
            });
            d.on("valueChanged", deviceValueChanged);
            devs.push(d);
        }
    });
}

hs.on("ready", function() {
    db.get("myq", function(err, data) {
        if (data === undefined) {
            db.save("myq", { username: "", password: "" });
            console.log("wrote cfg");
        } else if (!err) {
            console.log("got username", data.username);
            garage = new myq(data.username, data.password);
            garage.login(function(err, res) {
                if (err)
                    throw err;
                garage.getDevices(function(err, devices) {
                    if (err)
                        throw err;
                    console.log(devices);
                    createDevices(devices);
                });
            });
        }
    });
});
hs.on("request", function(req) {
    var p, k, cmd = req.command;
    if (cmd) {
        switch (cmd.function) {
        case "triggerCount":
            return { value: 0 };
        }
    }
    return undefined;
});
