/* eslint-disable no-undef */
/**
 * Generic OntoLex Sidebar Manager
 * Handles pagination, loading states, and item rendering for OntoLex entity sidebars
 */
window.OntolexSidebar = {
  /**
   * Initialize a sidebar for an OntoLex entity type
   * @param {Object} config - Configuration object
   * @param {string} config.containerId - ID of the sidebar container element
   * @param {string} config.entityType - Type of entity (e.g., 'forms', 'lexical_entries', etc.)
   * @param {string} config.ontologyAcronym - Ontology acronym
   * @param {string} config.externalRestUrl - Base URL for API calls
   * @param {string} config.apikey - API key for authentication
   * @param {number} config.pageSize - Number of items per page (default: 50)
   * @param {Function} config.renderItem - Function to render a single item
   * @param {Function} config.onItemSelect - Callback when an item is selected
   * @param {Function} config.getBadgeProperty - Function to extract badge property from item (optional)
   * @param {string} config.noItemsMessage - Message to show when no items found
   */
  create: function (config) {
    var state = {
      currentPage: 1,
      pageSize: config.pageSize || 50,
      selectedItemId: null,
      isLoading: false,
      containerId: config.containerId,
      entityType: config.entityType,
      ontologyAcronym: config.ontologyAcronym,
      externalRestUrl: config.externalRestUrl,
      apikey: config.apikey,
      renderItem: config.renderItem,
      onItemSelect: config.onItemSelect,
      getBadgeProperty: config.getBadgeProperty || null,
      noItemsMessage: config.noItemsMessage || 'No items found',
      preloadData: config.preloadData || null, // Function to preload additional data
    };

    var api = {
      loadPage: function (page) {
        if (state.isLoading) return;

        state.isLoading = true;
        this.showLoading();

        var apiUrl =
          state.externalRestUrl +
          '/ontologies/' +
          state.ontologyAcronym +
          '/' +
          state.entityType +
          '?page=' +
          page +
          '&pagesize=' +
          state.pageSize +
          '&apikey=' +
          state.apikey;

        var self = this;
        $.ajax({
          url: apiUrl,
          method: 'GET',
          dataType: 'json',
          success: function (data) {
            var items = data.collection || [];

            // Render sidebar immediately
            self.renderSidebar(items, data);
            state.isLoading = false;

            // If preloadData function exists, load additional data in background
            if (state.preloadData) {
              state.preloadData(items, state, self);
            }
          },
          error: function (xhr, status, error) {
            $('#' + state.containerId).html('<div class="alert alert-danger m-2">Error: ' + error + '</div>');
            state.isLoading = false;
          },
        });
      },

      showLoading: function () {
        var html = '<div class="text-center py-3">';
        html += '<span class="spinner-border spinner-border-sm" role="status"></span>';
        html += '</div>';
        $('#' + state.containerId).html(html);
      },

      renderSidebar: function (items, data) {
        var html = '';

        if (items.length === 0) {
          html = '<div class="text-center text-muted p-3">';
          html += '<i class="fas fa-inbox"></i>';
          html += '<p class="mt-2">' + state.noItemsMessage + '</p>';
          html += '</div>';
        } else {
          html = '<ul class="ontolex-sidebar-list list-unstyled">';

          for (var i = 0; i < items.length; i++) {
            var item = items[i];
            var itemId = item['@id'] || item.id || 'Unknown';
            var activeClass = state.selectedItemId === itemId ? ' active' : '';

            html += '<li class="ontolex-sidebar-item' + activeClass + '" data-id="' + itemId + '">';
            html += state.renderItem(item);
            html += '</li>';
          }

          html += '</ul>';

          // Pagination
          if (data.pageCount && data.pageCount > 1) {
            html += this.renderPagination(data);
          }
        }

        $('#' + state.containerId).html(html);
        this.attachEventHandlers(items);
      },

      renderPagination: function (data) {
        var html = '<div class="ontolex-sidebar-pagination p-2">';
        html += '<nav aria-label="Pagination"><ul class="pagination pagination-sm justify-content-center mb-0">';

        if (data.page > 1) {
          html += '<li class="page-item"><a class="page-link" href="#" data-page="' + (data.page - 1) + '">‹</a></li>';
        } else {
          html += '<li class="page-item disabled"><span class="page-link">‹</span></li>';
        }

        html +=
          '<li class="page-item disabled"><span class="page-link">' +
          data.page +
          ' / ' +
          data.pageCount +
          '</span></li>';

        if (data.page < data.pageCount) {
          html += '<li class="page-item"><a class="page-link" href="#" data-page="' + (data.page + 1) + '">›</a></li>';
        } else {
          html += '<li class="page-item disabled"><span class="page-link">›</span></li>';
        }

        html += '</ul></nav></div>';
        return html;
      },

      attachEventHandlers: function (items) {
        var self = this;

        // Item click handlers
        $('#' + state.containerId + ' .ontolex-sidebar-item')
          .off('click')
          .on('click', function () {
            var itemId = $(this).data('id');
            state.selectedItemId = itemId;

            $('#' + state.containerId + ' .ontolex-sidebar-item').removeClass('active');
            $(this).addClass('active');

            if (state.onItemSelect) {
              state.onItemSelect(itemId);
            }
          });

        // Pagination click handlers
        $('#' + state.containerId + ' .pagination a')
          .off('click')
          .on('click', function (e) {
            e.preventDefault();
            var page = $(this).data('page');
            state.currentPage = page;
            self.loadPage(page);
          });

        // Auto-select first item if none selected
        if (!state.selectedItemId && items.length > 0) {
          var firstId = items[0]['@id'] || items[0].id;
          state.selectedItemId = firstId;
          $('#' + state.containerId + ' .ontolex-sidebar-item')
            .first()
            .addClass('active');

          if (state.onItemSelect) {
            state.onItemSelect(firstId);
          }
        }
      },

      selectItem: function (itemId) {
        state.selectedItemId = itemId;
        if (state.onItemSelect) {
          state.onItemSelect(itemId);
        }
      },

      getState: function () {
        return state;
      },
    };

    return api;
  },

  /**
   * Common item renderer for entities with writtenRep/lemma and badge
   */
  createSimpleItemRenderer: function (displayProp, badgeProp) {
    return function (item) {
      var itemId = item['@id'] || item.id || 'Unknown';
      var displayText = item[displayProp] || itemId.split('/').pop();

      var html = '<div>' + displayText + '</div>';

      if (badgeProp && item[badgeProp]) {
        var badgeValue = item[badgeProp].split('/').pop();
        html +=
          '<div class="mt-1"><span class="ontolex-badge badge-language" title="' +
          item[badgeProp] +
          '">' +
          badgeValue +
          '</span></div>';
      }

      return html;
    };
  },

  /**
   * Item renderer with multiple badges
   */
  createMultiBadgeItemRenderer: function (displayProp, badgeProps) {
    return function (item) {
      var itemId = item['@id'] || item.id || 'Unknown';
      var displayText = item[displayProp] || itemId.split('/').pop();

      var html = '<div>' + displayText + '</div>';

      if (badgeProps && badgeProps.length > 0) {
        var badges = [];
        for (var i = 0; i < badgeProps.length; i++) {
          var prop = badgeProps[i];
          if (item[prop]) {
            var badgeValue = item[prop].split('#').pop() || item[prop].split('/').pop();
            badges.push(
              '<span class="ontolex-badge badge-' + prop + '" title="' + item[prop] + '">' + badgeValue + '</span>',
            );
          }
        }
        if (badges.length > 0) {
          html += '<div class="mt-1">' + badges.join(' ') + '</div>';
        }
      }

      return html;
    };
  },
};
