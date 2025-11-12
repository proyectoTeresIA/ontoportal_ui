// OntoLex Modal Functionality
// Shared across all OntoLex model views

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

    $(document)
      .off('click', '.entity-link')
      .on('click', '.entity-link', function (e) {
        e.preventDefault();
        var type = $(this).data('type');
        var id = $(this).data('id');
        var title = $(this).text();
        loadEntity(type, id, title);
      });
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
    $('#ontolexModal .modal-title').text(title || 'OntoLex Entity Details');
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
        var html = renderEntityDetails(type, data);
        $('#ontolexModalContent').html(html);
      },
      error: function (xhr, status, error) {
        $('#ontolexModalContent').html('<div class="alert alert-danger">Error loading details: ' + error + '</div>');
      },
    });
  }

  function renderEntityDetails(type, data) {
    var html = '<div class="entity-details">';
    var itemId = data['@id'] || data.id || 'Unknown';

    if (type === 'lexical_concepts') {
      html += '<h6>Lexical Concept</h6>';
      html += '<p class="text-muted small mb-3"><strong>ID:</strong> <code>' + itemId + '</code></p>';

      if (data.definition && Array.isArray(data.definition) && data.definition.length > 0) {
        html += '<div class="mb-3"><strong class="d-block mb-2">Definition:</strong>';
        data.definition.forEach(function (def) {
          if (def.label) {
            html += '<div class="ps-3 mb-2">' + def.label;
            if (def.language) {
              html += ' <span class="badge bg-secondary ms-2">' + def.language + '</span>';
            }
            html += '</div>';
          }
        });
        html += '</div>';
      }

      if (data.subject && data.subject.prefLabel) {
        html +=
          '<div class="mb-3"><strong>Subject:</strong> <span class="badge bg-info ms-2">' +
          data.subject.prefLabel +
          '</span></div>';
      }

      if (data.inScheme) {
        html +=
          '<div class="mb-3"><strong>In Scheme:</strong> <div class="mt-1"><code class="small">' +
          data.inScheme +
          '</code></div></div>';
      }

      if (data.isEvokedBy && data.isEvokedBy.length > 0) {
        html +=
          '<div class="mb-3"><strong class="d-block mb-2">Evoked By (' + data.isEvokedBy.length + ' entries):</strong>';
        html += '<ul class="list-unstyled ps-3">';
        data.isEvokedBy.slice(0, 10).forEach(function (entryId) {
          html +=
            '<li class="mb-1"><a href="#" class="entity-link text-decoration-none" data-type="lexical_entries" data-id="' +
            entryId +
            '"><i class="fas fa-link me-1"></i>' +
            entryId.split('/').pop() +
            '</a></li>';
        });
        if (data.isEvokedBy.length > 10) {
          html += '<li class="text-muted small">... and ' + (data.isEvokedBy.length - 10) + ' more</li>';
        }
        html += '</ul></div>';
      }

      if (data.lexicalizedSense && data.lexicalizedSense.length > 0) {
        html +=
          '<div class="mb-3"><strong class="d-block mb-2">Lexicalized Senses (' +
          data.lexicalizedSense.length +
          '):</strong>';
        html += '<ul class="list-unstyled ps-3">';
        data.lexicalizedSense.slice(0, 10).forEach(function (senseId) {
          html +=
            '<li class="mb-1"><a href="#" class="entity-link text-decoration-none" data-type="lexical_senses" data-id="' +
            senseId +
            '"><i class="fas fa-link me-1"></i>' +
            senseId.split('/').pop() +
            '</a></li>';
        });
        if (data.lexicalizedSense.length > 10) {
          html += '<li class="text-muted small">... and ' + (data.lexicalizedSense.length - 10) + ' more</li>';
        }
        html += '</ul></div>';
      }
    } else if (type === 'lexical_entries') {
      html += '<h6>Lexical Entry</h6>';
      html += '<p class="text-muted small mb-3"><strong>ID:</strong> <code>' + itemId + '</code></p>';

      var writtenRep = 'N/A';
      if (data.canonicalForm && data.canonicalForm.writtenRep) {
        writtenRep = data.canonicalForm.writtenRep;
      } else if (data.form && Array.isArray(data.form) && data.form.length > 0 && data.form[0].writtenRep) {
        writtenRep = data.form[0].writtenRep;
      }
      html += '<div class="mb-3"><strong>Written Form:</strong> <span class="ms-2">' + writtenRep + '</span></div>';

      if (data.language) {
        var langCode = data.language.split('/').pop();
        html +=
          '<div class="mb-3"><strong>Language:</strong> <span class="badge bg-info ms-2">' + langCode + '</span></div>';
      }

      if (data.partOfSpeech) {
        var pos = data.partOfSpeech.split('#').pop() || data.partOfSpeech.split('/').pop();
        html +=
          '<div class="mb-3"><strong>Part of Speech:</strong> <span class="badge bg-secondary ms-2">' +
          pos +
          '</span></div>';
      }

      if (data.evokes) {
        var evokesId = Array.isArray(data.evokes) ? data.evokes[0] : data.evokes;
        html +=
          '<div class="mb-3"><strong>Evokes Concept:</strong> <a href="#" class="entity-link ms-2" data-type="lexical_concepts" data-id="' +
          evokesId +
          '"><i class="fas fa-link me-1"></i>' +
          evokesId.split('/').pop() +
          '</a></div>';
      }

      if (data.form && Array.isArray(data.form) && data.form.length > 0) {
        html += '<div class="mb-3"><strong class="d-block mb-2">Forms (' + data.form.length + '):</strong>';
        html += '<ul class="list-unstyled ps-3">';
        data.form.forEach(function (form) {
          var formId = typeof form === 'string' ? form : form['@id'] || form.id;
          var formLabel = form.writtenRep || formId.split('/').pop();
          html +=
            '<li class="mb-1"><a href="#" class="entity-link text-decoration-none" data-type="forms" data-id="' +
            formId +
            '"><i class="fas fa-link me-1"></i>' +
            formLabel +
            '</a></li>';
        });
        html += '</ul></div>';
      }

      if (data.sense && Array.isArray(data.sense) && data.sense.length > 0) {
        html += '<div class="mb-3"><strong class="d-block mb-2">Senses (' + data.sense.length + '):</strong>';
        html += '<ul class="list-unstyled ps-3">';
        data.sense.forEach(function (sense) {
          var senseId = typeof sense === 'string' ? sense : sense['@id'] || sense.id;
          html +=
            '<li class="mb-1"><a href="#" class="entity-link text-decoration-none" data-type="lexical_senses" data-id="' +
            senseId +
            '"><i class="fas fa-link me-1"></i>' +
            senseId.split('/').pop() +
            '</a></li>';
        });
        html += '</ul></div>';
      }
    } else if (type === 'forms') {
      html += '<h6>Form</h6>';
      html += '<p class="text-muted small mb-3"><strong>ID:</strong> <code>' + itemId + '</code></p>';

      if (data.writtenRep) {
        html +=
          '<div class="mb-3"><strong>Written Representation:</strong> <span class="ms-2">' +
          data.writtenRep +
          '</span></div>';
      }

      if (data.gender) {
        var gender = data.gender.split('#').pop() || data.gender.split('/').pop();
        html +=
          '<div class="mb-3"><strong>Gender:</strong> <span class="badge bg-secondary ms-2">' +
          gender +
          '</span></div>';
      }

      if (data.number) {
        var number = data.number.split('#').pop() || data.number.split('/').pop();
        html +=
          '<div class="mb-3"><strong>Number:</strong> <span class="badge bg-secondary ms-2">' +
          number +
          '</span></div>';
      }
    } else if (type === 'lexical_senses') {
      html += '<h6>Lexical Sense</h6>';
      html += '<p class="text-muted small mb-3"><strong>ID:</strong> <code>' + itemId + '</code></p>';

      if (data.definition) {
        html +=
          '<div class="mb-3"><strong class="d-block mb-2">Definition:</strong><div class="ps-3">' +
          data.definition +
          '</div></div>';
      }

      if (data.example) {
        html +=
          '<div class="mb-3"><strong class="d-block mb-2">Example:</strong><div class="ps-3 fst-italic">' +
          data.example +
          '</div></div>';
      }

      if (data.reference) {
        html += '<div class="mb-3"><strong>Reference:</strong> <span class="ms-2">' + data.reference + '</span></div>';
      }

      if (data.isSenseOf) {
        var entryId = Array.isArray(data.isSenseOf) ? data.isSenseOf[0] : data.isSenseOf;
        html +=
          '<div class="mb-3"><strong>Sense Of:</strong> <a href="#" class="entity-link ms-2" data-type="lexical_entries" data-id="' +
          entryId +
          '"><i class="fas fa-link me-1"></i>' +
          entryId.split('/').pop() +
          '</a></div>';
      }

      if (data.lexicalConcept) {
        var conceptId = Array.isArray(data.lexicalConcept) ? data.lexicalConcept[0] : data.lexicalConcept;
        html +=
          '<div class="mb-3"><strong>Lexical Concept:</strong> <a href="#" class="entity-link ms-2" data-type="lexical_concepts" data-id="' +
          conceptId +
          '"><i class="fas fa-link me-1"></i>' +
          conceptId.split('/').pop() +
          '</a></div>';
      }

      if (data.synonym && data.synonym.length > 0) {
        html += '<div class="mb-3"><strong class="d-block mb-2">Synonyms (' + data.synonym.length + '):</strong>';
        html += '<ul class="list-unstyled ps-3">';
        data.synonym.slice(0, 10).forEach(function (synId) {
          html +=
            '<li class="mb-1"><a href="#" class="entity-link text-decoration-none" data-type="lexical_senses" data-id="' +
            synId +
            '"><i class="fas fa-link me-1"></i>' +
            synId.split('/').pop() +
            '</a></li>';
        });
        if (data.synonym.length > 10) {
          html += '<li class="text-muted small">... and ' + (data.synonym.length - 10) + ' more</li>';
        }
        html += '</ul></div>';
      }

      if (data.translation && data.translation.length > 0) {
        html +=
          '<div class="mb-3"><strong class="d-block mb-2">Translations (' + data.translation.length + '):</strong>';
        html += '<ul class="list-unstyled ps-3">';
        data.translation.slice(0, 10).forEach(function (transId) {
          html +=
            '<li class="mb-1"><a href="#" class="entity-link text-decoration-none" data-type="lexical_senses" data-id="' +
            transId +
            '"><i class="fas fa-link me-1"></i>' +
            transId.split('/').pop() +
            '</a></li>';
        });
        if (data.translation.length > 10) {
          html += '<li class="text-muted small">... and ' + (data.translation.length - 10) + ' more</li>';
        }
        html += '</ul></div>';
      }
    }

    html += '</div>';
    return html;
  }

  return {
    init: init,
    loadEntity: loadEntity,
  };
})();
