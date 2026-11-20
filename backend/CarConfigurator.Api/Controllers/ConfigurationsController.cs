using System.Security.Claims;
using CarConfigurator.Api.Dtos;
using CarConfigurator.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace CarConfigurator.Api.Controllers;

[ApiController]
[Route("api/configurations")]
public class ConfigurationsController : ControllerBase
{
    private readonly IConfigurationService _configurationService;

    public ConfigurationsController(IConfigurationService configurationService)
    {
        _configurationService = configurationService;
    }

    [HttpGet("options")]
    public ActionResult<IReadOnlyList<OptionDto>> GetOptions()
    {
        return Ok(_configurationService.GetAvailableOptions());
    }

    [HttpPost("evaluate")]
    public ActionResult<ConfigurationEvaluationResultDto> Evaluate([FromBody] ConfigurationRequestDto? request)
    {
        var result = _configurationService.EvaluateConfiguration(request!);
        if (result.HasInvalidInput)
        {
            return BadRequest(result);
        }

        return Ok(result);
    }

    [HttpPost]
    public IActionResult Save([FromBody] SaveConfigurationRequestDto? request)
    {
        var userId = ResolveCurrentUserId();
        var result = _configurationService.SaveConfiguration(request!, userId);
        return ToActionResult(result);
    }

    [HttpGet]
    public IActionResult GetMyConfigurations()
    {
        var userId = ResolveCurrentUserId();
        var result = _configurationService.GetUserConfigurations(userId);
        return ToActionResult(result);
    }

    [HttpGet("{id:int}")]
    public IActionResult GetById(int id)
    {
        var userId = ResolveCurrentUserId();
        var result = _configurationService.GetSavedConfigurationById(id, userId);
        return ToActionResult(result);
    }

    [HttpPut("{id:int}")]
    public IActionResult Update(int id, [FromBody] SaveConfigurationRequestDto? request)
    {
        var userId = ResolveCurrentUserId();
        var result = _configurationService.UpdateSavedConfiguration(id, request!, userId);
        return ToActionResult(result);
    }

    [HttpDelete("{id:int}")]
    public IActionResult Delete(int id)
    {
        var userId = ResolveCurrentUserId();
        var result = _configurationService.DeleteSavedConfiguration(id, userId);
        return ToActionResult(result);
    }

    private string? ResolveCurrentUserId()
    {
        var claimUserId = User?.FindFirst(ClaimTypes.NameIdentifier)?.Value
                          ?? User?.Identity?.Name;
        if (!string.IsNullOrWhiteSpace(claimUserId))
        {
            return claimUserId;
        }

        if (Request?.Headers != null)
        {
            if (Request.Headers.TryGetValue("Authorization", out var authValues))
            {
                var authHeader = authValues.FirstOrDefault();
                const string prefix = "Bearer mock-jwt-token-";
                if (!string.IsNullOrWhiteSpace(authHeader) &&
                    authHeader.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
                {
                    var extractedUser = authHeader.Substring(prefix.Length).Trim();
                    if (!string.IsNullOrWhiteSpace(extractedUser))
                    {
                        return extractedUser;
                    }
                }
            }

            if (Request.Headers.TryGetValue("X-User-Id", out var headerValues))
            {
                var headerUserId = headerValues.FirstOrDefault();
                if (!string.IsNullOrWhiteSpace(headerUserId))
                {
                    return headerUserId;
                }
            }
        }

        return null;
    }

    private IActionResult ToActionResult<T>(ServiceResult<T> result)
    {
        return result.StatusCode switch
        {
            StatusCodes.Status200OK => Ok(result.Data),
            StatusCodes.Status201Created => StatusCode(StatusCodes.Status201Created, result.Data),
            StatusCodes.Status204NoContent => NoContent(),
            StatusCodes.Status400BadRequest => BadRequest((object?)result.ValidationResult ?? new { error = result.ErrorMessage }),
            StatusCodes.Status401Unauthorized => Unauthorized(new { error = result.ErrorMessage }),
            StatusCodes.Status403Forbidden => StatusCode(StatusCodes.Status403Forbidden, new { error = result.ErrorMessage }),
            StatusCodes.Status404NotFound => NotFound(new { error = result.ErrorMessage }),
            _ => StatusCode(result.StatusCode, new { error = result.ErrorMessage })
        };
    }
}
