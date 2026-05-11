(function () {
  function parseMetaJson(name, fallbackValue) {
    var node = document.querySelector('meta[name="' + name + '"]');
    if (!node || !node.content) {
      return fallbackValue;
    }

    try {
      return JSON.parse(node.content);
    } catch (e) {
      return fallbackValue;
    }
  }

  function setBpData() {
    if (!window.jQuery) {
      return false;
    }

    var bpData = {
      config: parseMetaJson('bp-config', {}),
      user: parseMetaJson('bp-user', {}),
      ontology: parseMetaJson('bp-ontology', {}),
      submission_latest: parseMetaJson('bp-submission-latest', {}),
      ont_viewer: {},
      ont_chart: {},
    };

    jQuery(document).data({ bp: bpData });
    return true;
  }

  if (!setBpData()) {
    document.addEventListener('DOMContentLoaded', setBpData, { once: true });
  }
})();
