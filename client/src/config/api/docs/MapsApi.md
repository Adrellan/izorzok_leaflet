# MapsApi

All URIs are relative to *http://localhost:3000*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**apiMapsRegionsGet**](#apimapsregionsget) | **GET** /api/maps/regions | Régiók listázása (GeoJSON geometriával)|
|[**apiMapsSettlementsGet**](#apimapssettlementsget) | **GET** /api/maps/settlements | Települések listázása (GeoJSON geometriával)|

# **apiMapsRegionsGet**
> Array<RegionWithGeom> apiMapsRegionsGet()

Visszaadja az összes régiót név szerinti rendezéssel. A `geom` mező GeoJSON Geometry objektum.

### Example

```typescript
import {
    MapsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MapsApi(configuration);

let regionId: Array<number>; //Opcionális szűrés. Több regionId megadható (?regionId=1&regionId=2) vagy vesszővel elválasztva (?regionId=1,2). (optional) (default to undefined)

const { status, data } = await apiInstance.apiMapsRegionsGet(
    regionId
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **regionId** | **Array&lt;number&gt;** | Opcionális szűrés. Több regionId megadható (?regionId&#x3D;1&amp;regionId&#x3D;2) vagy vesszővel elválasztva (?regionId&#x3D;1,2). | (optional) defaults to undefined|


### Return type

**Array<RegionWithGeom>**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Sikeres lekérdezés |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **apiMapsSettlementsGet**
> Array<SettlementWithGeom> apiMapsSettlementsGet()

Visszaadja az összes települést név szerinti rendezéssel. A `geom` mező GeoJSON Geometry objektum.

### Example

```typescript
import {
    MapsApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new MapsApi(configuration);

let regionId: Array<number>; //Opcionális szűrés. Több regionId megadható (?regionId=1&regionId=2) vagy vesszővel elválasztva (?regionId=1,2). (optional) (default to undefined)
let settlementid: Array<number>; //Opcionális szűrés. Több település ID is megadható (?settlementid=101&settlementid=102) vagy vesszővel elválasztva (?settlementid=101,102). (optional) (default to undefined)

const { status, data } = await apiInstance.apiMapsSettlementsGet(
    regionId,
    settlementid
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **regionId** | **Array&lt;number&gt;** | Opcionális szűrés. Több regionId megadható (?regionId&#x3D;1&amp;regionId&#x3D;2) vagy vesszővel elválasztva (?regionId&#x3D;1,2). | (optional) defaults to undefined|
| **settlementid** | **Array&lt;number&gt;** | Opcionális szűrés. Több település ID is megadható (?settlementid&#x3D;101&amp;settlementid&#x3D;102) vagy vesszővel elválasztva (?settlementid&#x3D;101,102). | (optional) defaults to undefined|


### Return type

**Array<SettlementWithGeom>**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Sikeres lekérdezés |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

