let names = [];

function getNames() {
    return names;
}

function setNames(newNames) {
    names = newNames;
}

module.exports = {
    getNames,
    setNames
};

// Basic State To Send Correctly Updated Data