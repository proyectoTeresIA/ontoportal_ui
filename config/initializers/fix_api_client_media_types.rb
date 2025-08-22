# Monkey patch to fix media type mismatch between client and API
# The client expects 'http://data.bioontology.org/...' but the API returns local URLs

module LinkedData
  module Client
    module Collection
      module ClassMethods
        # Override uri_from_context to handle both bioontology.org and local API media types
        def uri_from_context(object, media_type)
          puts "DEBUG: uri_from_context called with media_type: #{media_type}" if $DEBUG_API_CLIENT
          
          # Handle new API structure - object.links is a hash of URLs
          if object.respond_to?(:links) && object.links.is_a?(Hash)
            puts "DEBUG: Using links hash, available keys: #{object.links.keys}" if $DEBUG_API_CLIENT
            
            # Map media types to API endpoint keys
            media_type_map = {
              'http://data.bioontology.org/metadata/Ontology' => 'ontologies',
              'http://data.bioontology.org/metadata/OntologySubmission' => 'submissions',
              'http://data.bioontology.org/metadata/Category' => 'categories',
              'http://data.bioontology.org/metadata/Group' => 'groups',
              'http://data.bioontology.org/metadata/Metrics' => 'metrics',
              'application/vnd.ontologies+json' => 'ontologies'
            }
            
            key = media_type_map[media_type]
            if key && object.links[key]
              puts "DEBUG: Found URL for #{key}: #{object.links[key]}" if $DEBUG_API_CLIENT
              return object.links[key]
            end
          end
          
          # Fallback: try the original structure (object.links with media_type)
          if object.respond_to?(:links) && !object.links.is_a?(Hash)
            object.links.each do |type, link|
              return link if link.respond_to?(:media_type) && 
                           link.media_type && 
                           link.media_type.downcase.eql?(media_type.downcase)
            end
            
            # If not found and media_type contains data.bioontology.org, try with local API host
            if media_type.include?('data.bioontology.org')
              local_media_type = media_type.gsub('data.bioontology.org', LinkedData::Client.settings.rest_url.gsub('http://', '').gsub('https://', ''))
              object.links.each do |type, link|
                return link if link.respond_to?(:media_type) && 
                             link.media_type && 
                             link.media_type.downcase.eql?(local_media_type.downcase)
              end
            end
          end
          
          puts "DEBUG: No URL found for media_type: #{media_type}" if $DEBUG_API_CLIENT
          nil
        end
      end
    end
    
    # Patch HTTP requests to redirect bioontology.org URLs to local API
    module HTTP
      class << self
        alias_method :original_get, :get if method_defined?(:get)
        alias_method :original_post, :post if method_defined?(:post)
        alias_method :original_put, :put if method_defined?(:put)
        alias_method :original_patch, :patch if method_defined?(:patch)
        alias_method :original_delete, :delete if method_defined?(:delete)
        
        def get(path, params = {}, options = {})
          puts "DEBUG: HTTP.get called with path: #{path.inspect}" if $DEBUG_API_CLIENT
          path = convert_bioontology_url(path)
          puts "DEBUG: After convert_bioontology_url: #{path.inspect}" if $DEBUG_API_CLIENT
          original_get(path, params, options)
        end
        
        def post(path, obj, options = {})
          path = convert_bioontology_url(path)
          original_post(path, obj, options)
        end
        
        def put(path, obj)
          path = convert_bioontology_url(path)
          original_put(path, obj)
        end
        
        def patch(path, obj)
          path = convert_bioontology_url(path)
          original_patch(path, obj)
        end
        
        def delete(path)
          path = convert_bioontology_url(path)
          original_delete(path)
        end
        
        private
        
        def convert_bioontology_url(path)
          puts "DEBUG: convert_bioontology_url called with: #{path.inspect}" if $DEBUG_API_CLIENT
          # Return nil if path is nil
          return nil unless path
          
          if path.include?('data.bioontology.org')
            rest_url = LinkedData::Client.settings.rest_url
            path = path.gsub('http://data.bioontology.org', rest_url)
            path = path.gsub('https://data.bioontology.org', rest_url)
            puts "DEBUG: Converted URL to: #{path}" if $DEBUG_API_CLIENT
          end
          path
        end
      end
    end
  end
end
