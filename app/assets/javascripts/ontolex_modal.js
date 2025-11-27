// OntoLex Modal Functionality

// Store config in window object to survive script reloads
window.OntolexModalConfig = window.OntolexModalConfig || {
  ontologyAcronym: null,
  externalRestUrl: null,
  apikey: null,
  modalInstance: null,
};

window.OntolexModal = (function () {
  function init(acronym, restUrl, key) {
    window.OntolexModalConfig.ontologyAcronym = acronym;
    window.OntolexModalConfig.externalRestUrl = restUrl;
    window.OntolexModalConfig.apikey = key;
  }

  function loadEntity(type, id, title) {
    // Use config from window object
    var ontologyAcronym = window.OntolexModalConfig.ontologyAcronym;
    var externalRestUrl = window.OntolexModalConfig.externalRestUrl;
    var apikey = window.OntolexModalConfig.apikey;

    // Validate that we have the required context
    if (!ontologyAcronym || !externalRestUrl || !apikey) {
      console.error('OntolexModal not properly initialized', {
        ontologyAcronym: ontologyAcronym,
        externalRestUrl: externalRestUrl,
        apikey: apikey,
      });
      return;
    }

    // Find the modal element (should always exist in the layout now)
    var modalElement = document.getElementById('ontolexModal');
    if (!modalElement) {
      console.error('Modal element #ontolexModal not found in DOM');
      return;
    }

    // Update modal content
    $('#ontolexModal .modal-title').text(title || 'Form Details');
    $('#ontolexModalContent').html(
      '<p class="text-center"><span class="spinner-border spinner-border-sm" role="status"></span><span class="ms-2">Loading...</span></p>',
    );

    // Get or create modal instance (singleton pattern - only created once)
    if (!window.OntolexModalConfig.modalInstance) {
      window.OntolexModalConfig.modalInstance = new bootstrap.Modal(modalElement, {
        backdrop: true,
        keyboard: true,
        focus: true,
      });

      // Set up cleanup when modal is hidden (only once)
      $(modalElement).on('hidden.bs.modal', function () {
        $('.modal-backdrop').remove();
        $('body').removeClass('modal-open').css('overflow', '').css('padding-right', '');
      });
    }

    // Show the modal
    window.OntolexModalConfig.modalInstance.show();

    var apiUrl =
      externalRestUrl +
      '/ontologies/' +
      ontologyAcronym +
      '/' +
      type +
      '/' +
      encodeURIComponent(id) +
      '?apikey=' +
      apikey;

    $.ajax({
      url: apiUrl,
      method: 'GET',
      dataType: 'json',
      success: function (data) {
        var html = renderFormDetails(data);
        $('#ontolexModalContent').html(html);
      },
      error: function (xhr, status, error) {
        $('#ontolexModalContent').html('<div class="alert alert-danger">Error loading details: ' + error + '</div>');
      },
    });
  }

  function renderFormDetails(data) {
    var html = '<div class="entity-details">';
    var itemId = data['@id'] || data.id || 'Unknown';

    html += '<h6>Form</h6>';
    html += '<p class="text-muted small mb-3"><strong>ID:</strong> <code>' + itemId + '</code></p>';

    // Written Representation
    if (data.writtenRep) {
      html +=
        '<div class="mb-3"><strong>Written Representation:</strong> <span class="ms-2 fs-5">' +
        data.writtenRep +
        '</span></div>';
    }

    // Phonetic Representation
    if (data.phoneticRep) {
      html +=
        '<div class="mb-3"><strong>Phonetic Representation:</strong> <span class="ms-2">' +
        data.phoneticRep +
        '</span></div>';
    }

    // Gender
    if (data.gender) {
      var gender = data.gender.split('#').pop() || data.gender.split('/').pop();
      html +=
        '<div class="mb-3"><strong>Gender:</strong> <span class="ontolex-badge badge-gender ms-2">' +
        gender +
        '</span></div>';
    }

    // Number
    if (data.number) {
      var number = data.number.split('#').pop() || data.number.split('/').pop();
      html +=
        '<div class="mb-3"><strong>Number:</strong> <span class="ontolex-badge badge-number ms-2">' +
        number +
        '</span></div>';
    }

    // Person
    if (data.person) {
      var person = data.person.split('#').pop() || data.person.split('/').pop();
      html +=
        '<div class="mb-3"><strong>Person:</strong> <span class="ontolex-badge badge-person ms-2">' +
        person +
        '</span></div>';
    }

    // Tense
    if (data.tense) {
      var tense = data.tense.split('#').pop() || data.tense.split('/').pop();
      html +=
        '<div class="mb-3"><strong>Tense:</strong> <span class="ontolex-badge badge-tense ms-2">' +
        tense +
        '</span></div>';
    }

    // Mood
    if (data.mood) {
      var mood = data.mood.split('#').pop() || data.mood.split('/').pop();
      html +=
        '<div class="mb-3"><strong>Mood:</strong> <span class="ontolex-badge badge-mood ms-2">' +
        mood +
        '</span></div>';
    }

    // Degree
    if (data.degree) {
      var degree = data.degree.split('#').pop() || data.degree.split('/').pop();
      html +=
        '<div class="mb-3"><strong>Degree:</strong> <span class="ontolex-badge badge-degree ms-2">' +
        degree +
        '</span></div>';
    }

    // Associated Lexical Entries
    if (data.lexicalEntries && data.lexicalEntries.length > 0) {
      html +=
        '<div class="mb-3"><strong class="d-block mb-2">Associated Lexical Entries (' +
        data.lexicalEntries.length +
        '):</strong>';
      html += '<ul class="list-unstyled ps-3">';
      data.lexicalEntries.forEach(function (entryId) {
        var ontAcronym = window.OntolexModalConfig.ontologyAcronym;
        var entryCode = encodeURIComponent(entryId);
        var shortId = entryId.split('/').pop();
        html += '<li class="mb-1">';
        html +=
          '<a href="/ontologies/' +
          ontAcronym +
          '?p=terminological_entries&id=' +
          entryCode +
          '" class="text-decoration-none" data-turbo-frame="_top">';
        html += '<i class="fas fa-link me-1"></i>' + shortId;
        html += '</a>';
        html += '</li>';
      });
      html += '</ul></div>';
    }

    html += '</div>';
    return html;
  }

  return {
    init: init,
    loadEntity: loadEntity,
  };
})();
