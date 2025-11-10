# RecipesApi

All URIs are relative to *http://localhost:3000*

|Method | HTTP request | Description|
|------------- | ------------- | -------------|
|[**apiRecipesCategoriesGet**](#apirecipescategoriesget) | **GET** /api/recipes/categories | Kategóriák listázása|
|[**apiRecipesGet**](#apirecipesget) | **GET** /api/recipes | Receptek listázása|

# **apiRecipesCategoriesGet**
> Array<Category> apiRecipesCategoriesGet()

Visszaadja az összes recept kategóriát név szerinti rendezéssel.

### Example

```typescript
import {
    RecipesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new RecipesApi(configuration);

const { status, data } = await apiInstance.apiRecipesCategoriesGet();
```

### Parameters
This endpoint does not have any parameters.


### Return type

**Array<Category>**

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

# **apiRecipesGet**
> RecipeListResponse apiRecipesGet()

Visszaadja az összes receptet, opcionális szűrőkkel (év, település, kategória, régió, hozzávalók). A válasz tartalmazza az összes találat számát is.

### Example

```typescript
import {
    RecipesApi,
    Configuration
} from './api';

const configuration = new Configuration();
const apiInstance = new RecipesApi(configuration);

let regionId: Array<number>; //Opcionális szűrés régió(k) szerint. Több regionId megadható (?regionId=1&regionId=2) vagy vesszővel elválasztva (?regionId=1,2). A régió szűrő település ID-kká kerül kibontásra. (optional) (default to undefined)
let year: Array<number>; // (optional) (default to undefined)
let settlementId: Array<number>; //Opcionális szűrés település(ek) szerint. (optional) (default to undefined)
let categoryId: Array<number>; //Opcionális szűrés kategória(k) szerint. (optional) (default to undefined)
let ingredients: Array<string>; //Opcionális szűrés hozzávalók szerint. Több kifejezés esetén mindegyiknek szerepelnie kell az összetevők szövegében. (optional) (default to undefined)

const { status, data } = await apiInstance.apiRecipesGet(
    regionId,
    year,
    settlementId,
    categoryId,
    ingredients
);
```

### Parameters

|Name | Type | Description  | Notes|
|------------- | ------------- | ------------- | -------------|
| **regionId** | **Array&lt;number&gt;** | Opcionális szűrés régió(k) szerint. Több regionId megadható (?regionId&#x3D;1&amp;regionId&#x3D;2) vagy vesszővel elválasztva (?regionId&#x3D;1,2). A régió szűrő település ID-kká kerül kibontásra. | (optional) defaults to undefined|
| **year** | **Array&lt;number&gt;** |  | (optional) defaults to undefined|
| **settlementId** | **Array&lt;number&gt;** | Opcionális szűrés település(ek) szerint. | (optional) defaults to undefined|
| **categoryId** | **Array&lt;number&gt;** | Opcionális szűrés kategória(k) szerint. | (optional) defaults to undefined|
| **ingredients** | **Array&lt;string&gt;** | Opcionális szűrés hozzávalók szerint. Több kifejezés esetén mindegyiknek szerepelnie kell az összetevők szövegében. | (optional) defaults to undefined|


### Return type

**RecipeListResponse**

### Authorization

No authorization required

### HTTP request headers

 - **Content-Type**: Not defined
 - **Accept**: application/json


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
|**200** | Sikeres lekérdezés |  * X-Total-Count - Találatok teljes száma a szűrők figyelembevételével <br>  |

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)
