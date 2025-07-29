# Monkey patch to fix media type mismatch between client and API
# The client expects 'http://data.bioontology.org/...' but the API returns local URLs

module LinkedData
  module Client
    module Collection
      module ClassMethods
        # Override uri_from_context to handle both bioontology.org and local API media types
        def uri_from_context(object, media_type)
          # First try the original media type
          object.links.each do |type, link|
            return link if link.media_type && link.media_type.downcase.eql?(media_type.downcase)
          end
          
          # If not found and media_type contains data.bioontology.org, try with local API host
          if media_type.include?('data.bioontology.org')
            local_media_type = media_type.gsub('data.bioontology.org', LinkedData::Client.settings.rest_url.gsub('http://', '').gsub('https://', ''))
            object.links.each do |type, link|
              return link if link.media_type && link.media_type.downcase.eql?(local_media_type.downcase)
            end
          end
          
          # If still not found, return nil (original behavior)
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
          path = convert_bioontology_url(path)
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
          if path && path.include?('data.bioontology.org')
            rest_url = LinkedData::Client.settings.rest_url
            path = path.gsub('http://data.bioontology.org', rest_url)
            path = path.gsub('https://data.bioontology.org', rest_url)
          end
          path
        end
      end
    end
  end
end
