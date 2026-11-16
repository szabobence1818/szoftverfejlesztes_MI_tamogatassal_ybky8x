using System.Security.Claims;
using CarConfigurator.Api.Controllers;
using CarConfigurator.Api.Dtos;
using CarConfigurator.Api.Models;
using CarConfigurator.Api.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;

namespace CarConfigurator.Tests;

public class ConfigurationServiceTests
{
    private readonly ConfigurationService _service = new();

    // =========================================================================
    // 1. Elfogadási feltétel: [Normál – Árkalkuláció]
    // =========================================================================

    [Fact]
    public void EvaluateConfiguration_NormalPriceCalculation_ReturnsValidAndCorrectTotalPrice()
    {
        // Arrange – Alapmotor (10M Ft), metál szín (250e Ft) és 18" felni (350e Ft) -> 10 600 000 Ft
        var request = new ConfigurationRequestDto
        {
            EngineOptionId = ConfigurationService.OptionIds.BaseEngine,
            SelectedOptionIds = new List<int>
            {
                ConfigurationService.OptionIds.MetallicColor,
                ConfigurationService.OptionIds.Rim18
            }
        };

        // Act
        var result = _service.EvaluateConfiguration(request);

        // Assert
        Assert.True(result.IsValid);
        Assert.False(result.HasInvalidInput);
        Assert.True(result.CanSave);
        Assert.Empty(result.Errors);
        Assert.Equal(10_000_000m, result.BasePrice);
        Assert.Equal(600_000m, result.OptionsPrice);
        Assert.Equal(0m, result.DiscountAmount);
        Assert.Equal(10_600_000m, result.TotalPrice);
    }

    [Fact]
    public void EvaluateConfiguration_BaseEngineWithZeroCostDefaults_ReturnsBasePriceOnly()
    {
        var request = new ConfigurationRequestDto
        {
            EngineOptionId = ConfigurationService.OptionIds.BaseEngine,
            SelectedOptionIds = new List<int>
            {
                ConfigurationService.OptionIds.BaseWhiteColor,
                ConfigurationService.OptionIds.BaseRim17
            }
        };

        var result = _service.EvaluateConfiguration(request);

        Assert.True(result.IsValid);
        Assert.Empty(result.Errors);
        Assert.Equal(10_000_000m, result.TotalPrice);
        Assert.Equal(2, result.VisualLayers.Count);
        Assert.True(result.VisualLayers[0].ZIndex < result.VisualLayers[1].ZIndex);
    }

    // =========================================================================
    // 2. Elfogadási feltétel: [Normál/Határeset – Függőség]
    // =========================================================================

    [Fact]
    public void EvaluateConfiguration_PremiumSoundWithoutLargeNavigation_ReturnsInvalidAndDependencyError()
    {
        var request = new ConfigurationRequestDto
        {
            EngineOptionId = ConfigurationService.OptionIds.BaseEngine,
            SelectedOptionIds = new List<int>
            {
                ConfigurationService.OptionIds.PremiumSoundSystem
            }
        };

        var result = _service.EvaluateConfiguration(request);

        Assert.False(result.IsValid);
        Assert.False(result.CanSave);
        Assert.False(result.HasInvalidInput);
        var error = Assert.Single(result.Errors);
        Assert.Equal(ConfigurationService.ErrorCodes.DependencyMissing, error.Code);
        Assert.Contains(ConfigurationService.OptionIds.PremiumSoundSystem, error.AffectedOptionIds);
        Assert.Contains(ConfigurationService.OptionIds.LargeNavigation, error.AffectedOptionIds);
    }

    [Fact]
    public void EvaluateConfiguration_PremiumSoundWithLargeNavigation_ReturnsValidAndCalculatesBothPrices()
    {
        var request = new ConfigurationRequestDto
        {
            EngineOptionId = ConfigurationService.OptionIds.BaseEngine,
            SelectedOptionIds = new List<int>
            {
                ConfigurationService.OptionIds.LargeNavigation,
                ConfigurationService.OptionIds.PremiumSoundSystem
            }
        };

        var result = _service.EvaluateConfiguration(request);

        Assert.True(result.IsValid);
        Assert.True(result.CanSave);
        Assert.Empty(result.Errors);
        Assert.Equal(700_000m, result.OptionsPrice);
        Assert.Equal(10_700_000m, result.TotalPrice);
    }

    // =========================================================================
    // 3. Elfogadási feltétel: [Határeset – Kizárás és többszörös ütközés]
    // =========================================================================

    [Fact]
    public void EvaluateConfiguration_BaseEngineWithSportSuspension_ReturnsInvalidAndDoesNotSilentlyRemoveOption()
    {
        var request = new ConfigurationRequestDto
        {
            EngineOptionId = ConfigurationService.OptionIds.BaseEngine,
            SelectedOptionIds = new List<int>
            {
                ConfigurationService.OptionIds.SportSuspension
            }
        };

        var result = _service.EvaluateConfiguration(request);

        Assert.False(result.IsValid);
        Assert.False(result.CanSave);
        Assert.Contains(ConfigurationService.OptionIds.SportSuspension, result.SelectedOptionIds);
        var error = Assert.Single(result.Errors);
        Assert.Equal(ConfigurationService.ErrorCodes.ExclusionConflict, error.Code);
        Assert.Contains(ConfigurationService.OptionIds.BaseEngine, error.AffectedOptionIds);
        Assert.Contains(ConfigurationService.OptionIds.SportSuspension, error.AffectedOptionIds);
    }

    [Fact]
    public void EvaluateConfiguration_SportEngineWithSportSuspension_ReturnsValid()
    {
        var request = new ConfigurationRequestDto
        {
            EngineOptionId = ConfigurationService.OptionIds.SportEngine,
            SelectedOptionIds = new List<int>
            {
                ConfigurationService.OptionIds.SportSuspension
            }
        };

        var result = _service.EvaluateConfiguration(request);

        Assert.True(result.IsValid);
        Assert.True(result.CanSave);
        Assert.Empty(result.Errors);
        Assert.Equal(13_850_000m, result.TotalPrice);
    }

    [Fact]
    public void EvaluateConfiguration_SportDiffuserWithTowHook_ReturnsInvalidAndExclusionError()
    {
        var request = new ConfigurationRequestDto
        {
            EngineOptionId = ConfigurationService.OptionIds.BaseEngine,
            SelectedOptionIds = new List<int>
            {
                ConfigurationService.OptionIds.SportDiffuser,
                ConfigurationService.OptionIds.TowHook
            }
        };

        var result = _service.EvaluateConfiguration(request);

        Assert.False(result.IsValid);
        Assert.False(result.CanSave);
        var error = Assert.Single(result.Errors);
        Assert.Equal(ConfigurationService.ErrorCodes.ExclusionConflict, error.Code);
        Assert.Contains(ConfigurationService.OptionIds.SportDiffuser, error.AffectedOptionIds);
        Assert.Contains(ConfigurationService.OptionIds.TowHook, error.AffectedOptionIds);
    }

    [Fact]
    public void EvaluateConfiguration_SimultaneousDependencyAndExclusionConflicts_ReturnsBothErrors()
    {
        var request = new ConfigurationRequestDto
        {
            EngineOptionId = ConfigurationService.OptionIds.BaseEngine,
            SelectedOptionIds = new List<int>
            {
                ConfigurationService.OptionIds.SportSuspension,
                ConfigurationService.OptionIds.PremiumSoundSystem
            }
        };

        var result = _service.EvaluateConfiguration(request);

        Assert.False(result.IsValid);
        Assert.False(result.CanSave);
        Assert.Equal(2, result.Errors.Count);
        Assert.Contains(result.Errors, e => e.Code == ConfigurationService.ErrorCodes.DependencyMissing);
        Assert.Contains(result.Errors, e => e.Code == ConfigurationService.ErrorCodes.ExclusionConflict);
    }

    // =========================================================================
    // 4. Elfogadási feltétel: [Határeset – Csomagkedvezmény (Téli csomag 20%)]
    // =========================================================================

    [Fact]
    public void EvaluateConfiguration_FullWinterPackageSelected_Applies20PercentDiscount()
    {
        var request = new ConfigurationRequestDto
        {
            EngineOptionId = ConfigurationService.OptionIds.BaseEngine,
            SelectedOptionIds = new List<int>
            {
                ConfigurationService.OptionIds.HeatedSeats,
                ConfigurationService.OptionIds.HeatedSteeringWheel,
                ConfigurationService.OptionIds.HeatedWindshield
            }
        };

        var result = _service.EvaluateConfiguration(request);

        Assert.True(result.IsValid);
        Assert.Equal(10_000_000m, result.BasePrice);
        Assert.Equal(400_000m, result.OptionsPrice);
        Assert.Equal(80_000m, result.DiscountAmount);
        Assert.Equal(10_320_000m, result.TotalPrice);
        Assert.Contains("Téli csomag", result.AppliedDiscounts);
    }

    [Theory]
    [InlineData(ConfigurationService.OptionIds.HeatedSeats, ConfigurationService.OptionIds.HeatedSteeringWheel, 250_000)]
    [InlineData(ConfigurationService.OptionIds.HeatedSeats, ConfigurationService.OptionIds.HeatedWindshield, 300_000)]
    [InlineData(ConfigurationService.OptionIds.HeatedSteeringWheel, ConfigurationService.OptionIds.HeatedWindshield, 250_000)]
    public void EvaluateConfiguration_TwoWinterPackageItemsSelected_RemovesDiscountAndChargesFullPrice(
        int firstOptionId,
        int secondOptionId,
        decimal expectedOptionsPrice)
    {
        var request = new ConfigurationRequestDto
        {
            EngineOptionId = ConfigurationService.OptionIds.BaseEngine,
            SelectedOptionIds = new List<int> { firstOptionId, secondOptionId }
        };

        var result = _service.EvaluateConfiguration(request);

        Assert.True(result.IsValid);
        Assert.Equal(expectedOptionsPrice, result.OptionsPrice);
        Assert.Equal(0m, result.DiscountAmount);
        Assert.Empty(result.AppliedDiscounts);
        Assert.Equal(10_000_000m + expectedOptionsPrice, result.TotalPrice);
    }

    [Theory]
    [InlineData(ConfigurationService.OptionIds.HeatedSeats, 150_000)]
    [InlineData(ConfigurationService.OptionIds.HeatedSteeringWheel, 100_000)]
    [InlineData(ConfigurationService.OptionIds.HeatedWindshield, 150_000)]
    public void EvaluateConfiguration_SingleWinterPackageItemSelected_NoDiscountApplied(
        int singleOptionId,
        decimal expectedOptionPrice)
    {
        var request = new ConfigurationRequestDto
        {
            EngineOptionId = ConfigurationService.OptionIds.BaseEngine,
            SelectedOptionIds = new List<int> { singleOptionId }
        };

        var result = _service.EvaluateConfiguration(request);

        Assert.True(result.IsValid);
        Assert.Equal(expectedOptionPrice, result.OptionsPrice);
        Assert.Equal(0m, result.DiscountAmount);
        Assert.Empty(result.AppliedDiscounts);
        Assert.Equal(10_000_000m + expectedOptionPrice, result.TotalPrice);
    }

    [Fact]
    public void EvaluateConfiguration_FullWinterPackagePlusOtherPaidOptions_AppliesDiscountOnlyToWinterPackageItems()
    {
        // Arrange – Téli csomag (400e Ft) + Metál szín (250e Ft) + Bőr kárpit (450e Ft) = 1 100 000 Ft opcióár
        // A 20% kedvezmény kizárólag a Téli csomag 400e Ft-os összegére jár (80 000 Ft), nem a teljes 1.1M Ft-ra!
        var request = new ConfigurationRequestDto
        {
            EngineOptionId = ConfigurationService.OptionIds.BaseEngine,
            SelectedOptionIds = new List<int>
            {
                ConfigurationService.OptionIds.MetallicColor,
                ConfigurationService.OptionIds.LeatherInterior,
                ConfigurationService.OptionIds.HeatedSeats,
                ConfigurationService.OptionIds.HeatedSteeringWheel,
                ConfigurationService.OptionIds.HeatedWindshield
            }
        };

        var result = _service.EvaluateConfiguration(request);

        Assert.True(result.IsValid);
        Assert.Equal(1_100_000m, result.OptionsPrice);
        Assert.Equal(80_000m, result.DiscountAmount);
        Assert.Equal(11_020_000m, result.TotalPrice);
    }

    [Fact]
    public void EvaluateConfiguration_PackageDiscountIncludingEngineOption_IncludesEnginePriceInDiscountCalculation()
    {
        // Arrange – Ha egy csomagkedvezménynek a motor is része (pl. Sport motor 13.5M + Sportfutómű 350e = 13.85M, 10% kedvezmény)
        var customService = new ConfigurationService();
        customService.AddPackageDiscount(new PackageDiscount
        {
            Id = 2,
            Name = "Sport csomag",
            RequiredOptionIds = new List<int>
            {
                ConfigurationService.OptionIds.SportEngine,
                ConfigurationService.OptionIds.SportSuspension
            },
            DiscountPercentage = 0.10m
        });

        var request = new ConfigurationRequestDto
        {
            EngineOptionId = ConfigurationService.OptionIds.SportEngine,
            SelectedOptionIds = new List<int> { ConfigurationService.OptionIds.SportSuspension }
        };

        var result = customService.EvaluateConfiguration(request);

        Assert.True(result.IsValid);
        Assert.Equal(1_385_000m, result.DiscountAmount);
        Assert.Equal(12_465_000m, result.TotalPrice);
    }

    // =========================================================================
    // 5. Elfogadási feltétel: [Hibás bemenet – Érvénytelen adatok és kategória-ütközések]
    // =========================================================================

    [Fact]
    public void EvaluateConfiguration_MissingEngineId_ReturnsInvalidInputError()
    {
        var request = new ConfigurationRequestDto
        {
            EngineOptionId = null,
            SelectedOptionIds = new List<int> { ConfigurationService.OptionIds.MetallicColor }
        };

        var result = _service.EvaluateConfiguration(request);

        Assert.False(result.IsValid);
        Assert.True(result.HasInvalidInput);
        Assert.False(result.CanSave);
        Assert.Contains(result.Errors, e => e.Code == ConfigurationService.ErrorCodes.MissingEngine);
    }

    [Theory]
    [InlineData(-1)]
    [InlineData(999)]
    [InlineData(ConfigurationService.OptionIds.MetallicColor)]
    public void EvaluateConfiguration_InvalidOrNonEngineIdPassedAsEngine_ReturnsInvalidEngineIdError(int invalidEngineId)
    {
        var request = new ConfigurationRequestDto
        {
            EngineOptionId = invalidEngineId,
            SelectedOptionIds = new List<int> { ConfigurationService.OptionIds.Rim18 }
        };

        var result = _service.EvaluateConfiguration(request);

        Assert.False(result.IsValid);
        Assert.True(result.HasInvalidInput);
        Assert.False(result.CanSave);
        var error = Assert.Single(result.Errors);
        Assert.Equal(ConfigurationService.ErrorCodes.InvalidEngineId, error.Code);
        Assert.Contains(invalidEngineId, error.AffectedOptionIds);
    }

    [Fact]
    public void EvaluateConfiguration_EngineIdPassedInSelectedOptions_ReturnsEngineInSelectedOptionsError()
    {
        var request = new ConfigurationRequestDto
        {
            EngineOptionId = ConfigurationService.OptionIds.BaseEngine,
            SelectedOptionIds = new List<int> { ConfigurationService.OptionIds.SportEngine }
        };

        var result = _service.EvaluateConfiguration(request);

        Assert.False(result.IsValid);
        Assert.True(result.HasInvalidInput);
        Assert.Contains(result.Errors, e => e.Code == ConfigurationService.ErrorCodes.EngineInSelectedOptions);
    }

    [Fact]
    public void EvaluateConfiguration_NonExistentOptionIdMinusOne_ReturnsInvalidInputError()
    {
        var request = new ConfigurationRequestDto
        {
            EngineOptionId = ConfigurationService.OptionIds.BaseEngine,
            SelectedOptionIds = new List<int> { -1 }
        };

        var result = _service.EvaluateConfiguration(request);

        Assert.False(result.IsValid);
        Assert.True(result.HasInvalidInput);
        Assert.False(result.CanSave);
        var error = Assert.Single(result.Errors);
        Assert.Equal(ConfigurationService.ErrorCodes.InvalidOptionId, error.Code);
        Assert.Contains(-1, error.AffectedOptionIds);
    }

    [Fact]
    public void EvaluateConfiguration_MultipleInvalidInputs_CollectsAllStructuralErrorsWithoutShortCircuiting()
    {
        // Arrange – Hiányzó motor + duplikált opció + két nem létező opció (-1, -2) egyszerre
        var request = new ConfigurationRequestDto
        {
            EngineOptionId = null,
            SelectedOptionIds = new List<int>
            {
                ConfigurationService.OptionIds.MetallicColor,
                ConfigurationService.OptionIds.MetallicColor,
                -1,
                -2
            }
        };

        var result = _service.EvaluateConfiguration(request);

        Assert.False(result.IsValid);
        Assert.True(result.HasInvalidInput);
        Assert.Contains(result.Errors, e => e.Code == ConfigurationService.ErrorCodes.MissingEngine);
        Assert.Contains(result.Errors, e => e.Code == ConfigurationService.ErrorCodes.DuplicateOptions);
        Assert.Equal(2, result.Errors.Count(e => e.Code == ConfigurationService.ErrorCodes.InvalidOptionId));
    }

    [Fact]
    public void EvaluateConfiguration_MultipleColorsOrRimsOrInteriorsSelected_ReturnsMultipleCategorySelectionError()
    {
        var request = new ConfigurationRequestDto
        {
            EngineOptionId = ConfigurationService.OptionIds.BaseEngine,
            SelectedOptionIds = new List<int>
            {
                ConfigurationService.OptionIds.BaseWhiteColor,
                ConfigurationService.OptionIds.FireRedColor,
                ConfigurationService.OptionIds.Rim18,
                ConfigurationService.OptionIds.SportRim19,
                ConfigurationService.OptionIds.FabricInterior,
                ConfigurationService.OptionIds.LeatherInterior
            }
        };

        var result = _service.EvaluateConfiguration(request);

        Assert.False(result.IsValid);
        Assert.True(result.HasInvalidInput);
        Assert.False(result.CanSave);
        Assert.Equal(3, result.Errors.Count(e => e.Code == ConfigurationService.ErrorCodes.MultipleCategorySelection));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public void ValidateSaveRequest_EmptyOrWhitespaceName_ReturnsInvalidInputError(string invalidName)
    {
        var saveRequest = new SaveConfigurationRequestDto
        {
            Name = invalidName,
            EngineOptionId = ConfigurationService.OptionIds.BaseEngine,
            SelectedOptionIds = new List<int> { ConfigurationService.OptionIds.MetallicColor }
        };

        var result = _service.ValidateSaveRequest(saveRequest);

        Assert.False(result.IsValid);
        Assert.True(result.HasInvalidInput);
        Assert.False(result.CanSave);
        Assert.Contains(result.Errors, e => e.Code == ConfigurationService.ErrorCodes.EmptyConfigurationName);
    }

    [Fact]
    public void ValidateSaveRequest_NullRequestOrNameTooLong_ReturnsAppropriateInputErrors()
    {
        var nullResult = _service.ValidateSaveRequest(null!);
        Assert.False(nullResult.IsValid);
        Assert.True(nullResult.HasInvalidInput);
        Assert.Contains(nullResult.Errors, e => e.Code == ConfigurationService.ErrorCodes.NullRequest);

        var longNameRequest = new SaveConfigurationRequestDto
        {
            Name = new string('A', ConfigurationService.MaxConfigurationNameLength + 1),
            EngineOptionId = ConfigurationService.OptionIds.BaseEngine,
            SelectedOptionIds = new List<int> { ConfigurationService.OptionIds.MetallicColor }
        };

        var longNameResult = _service.ValidateSaveRequest(longNameRequest);
        Assert.False(longNameResult.IsValid);
        Assert.True(longNameResult.HasInvalidInput);
        Assert.Contains(longNameResult.Errors, e => e.Code == ConfigurationService.ErrorCodes.ConfigurationNameTooLong);
    }

    // =========================================================================
    // 6. Elfogadási feltétel: [Jogosulatlan művelet – Védelem (401/403), CRUD és Visszatöltés]
    // =========================================================================

    [Fact]
    public void Controller_GuestSaveAttempt_Returns401Unauthorized()
    {
        var controller = CreateControllerWithUser(null);
        var saveRequest = new SaveConfigurationRequestDto
        {
            Name = "Vendég mentés",
            EngineOptionId = ConfigurationService.OptionIds.BaseEngine,
            SelectedOptionIds = new List<int> { ConfigurationService.OptionIds.MetallicColor }
        };

        var actionResult = controller.Save(saveRequest);

        var unauthorized = Assert.IsType<UnauthorizedObjectResult>(actionResult);
        Assert.Equal(StatusCodes.Status401Unauthorized, unauthorized.StatusCode);
    }

    [Fact]
    public void Controller_OtherUserAccessModifyOrDelete_Returns403Forbidden()
    {
        var service = new ConfigurationService();
        var userAController = CreateControllerWithUser("user-a", service);
        var userBController = CreateControllerWithUser("user-b", service);

        var saveRequest = new SaveConfigurationRequestDto
        {
            Name = "User A autója",
            EngineOptionId = ConfigurationService.OptionIds.BaseEngine,
            SelectedOptionIds = new List<int> { ConfigurationService.OptionIds.MetallicColor }
        };

        var createResponse = Assert.IsType<ObjectResult>(userAController.Save(saveRequest));
        Assert.Equal(StatusCodes.Status201Created, createResponse.StatusCode);
        var savedDto = Assert.IsType<SavedConfigurationDto>(createResponse.Value);

        // User B megpróbálja lekérni, módosítani és törölni User A mentését -> mindhárom 403 Forbidden
        var getForbidden = Assert.IsType<ObjectResult>(userBController.GetById(savedDto.Id));
        Assert.Equal(StatusCodes.Status403Forbidden, getForbidden.StatusCode);

        var updateForbidden = Assert.IsType<ObjectResult>(userBController.Update(savedDto.Id, saveRequest));
        Assert.Equal(StatusCodes.Status403Forbidden, updateForbidden.StatusCode);

        var deleteForbidden = Assert.IsType<ObjectResult>(userBController.Delete(savedDto.Id));
        Assert.Equal(StatusCodes.Status403Forbidden, deleteForbidden.StatusCode);
    }

    [Fact]
    public void Controller_SaveInvalidOrConflictingConfiguration_Returns400BadRequestWithoutSaving()
    {
        var service = new ConfigurationService();
        var controller = CreateControllerWithUser("user-a", service);

        // Üzletileg ütköző konfiguráció (Alap motor + Sportfutómű) mentése -> 400 Bad Request
        var conflictingRequest = new SaveConfigurationRequestDto
        {
            Name = "Ütköző konfiguráció",
            EngineOptionId = ConfigurationService.OptionIds.BaseEngine,
            SelectedOptionIds = new List<int> { ConfigurationService.OptionIds.SportSuspension }
        };

        var badRequest = Assert.IsType<BadRequestObjectResult>(controller.Save(conflictingRequest));
        Assert.Equal(StatusCodes.Status400BadRequest, badRequest.StatusCode);

        // Ellenőrizzük, hogy semmi nem került mentésre
        var myConfigs = service.GetUserConfigurations("user-a");
        Assert.Empty(myConfigs.Data!);
    }

    [Fact]
    public void GetSavedConfigurationById_ReloadAfterPriceAndRuleChange_PreservesSavedPriceAndRevalidates()
    {
        // Arrange – Elmentünk egy érvényes konfigurációt (Alap motor 10M + Metál szín 250e + 18" felni 350e = 10.6M Ft)
        var service = new ConfigurationService();
        var saveResult = service.SaveConfiguration(new SaveConfigurationRequestDto
        {
            Name = "Saját Konfiguráció",
            EngineOptionId = ConfigurationService.OptionIds.BaseEngine,
            SelectedOptionIds = new List<int>
            {
                ConfigurationService.OptionIds.MetallicColor,
                ConfigurationService.OptionIds.Rim18
            }
        }, "user-a");

        Assert.True(saveResult.IsSuccess);
        int savedId = saveResult.Data!.Id;
        Assert.Equal(10_600_000m, saveResult.Data.SavedTotalPrice);

        // Szimulálunk egy későbbi árváltozást (+100e Ft a 18" felnire) és egy új kizárási szabályt
        service.UpdateOptionPrice(ConfigurationService.OptionIds.Rim18, 450_000m);
        service.AddRule(new OptionRule
        {
            Id = 99,
            RuleType = RuleType.Excludes,
            SourceOptionId = ConfigurationService.OptionIds.MetallicColor,
            TargetOptionId = ConfigurationService.OptionIds.Rim18,
            ErrorMessage = "Új szabály: Metál szín és 18\" felni nem választható együtt."
        });

        // Act – Visszatöltjük a mentett konfigurációt
        var reloaded = service.GetSavedConfigurationById(savedId, "user-a");

        // Assert – A mentéskori ár (10.6M) megmarad, de a CurrentEvaluation újraszámolja (10.7M) és újra-validálja (IsValid=false)
        Assert.True(reloaded.IsSuccess);
        Assert.Equal(10_600_000m, reloaded.Data!.SavedTotalPrice);
        Assert.NotNull(reloaded.Data.CurrentEvaluation);
        Assert.Equal(10_700_000m, reloaded.Data.CurrentEvaluation!.TotalPrice);
        Assert.False(reloaded.Data.CurrentEvaluation.IsValid);
        Assert.Contains(reloaded.Data.CurrentEvaluation.Errors, e => e.Code == ConfigurationService.ErrorCodes.ExclusionConflict);
    }

    // =========================================================================
    // 7. Elfogadási feltétel: [Vizuális – 2D rétegek szűrése és ZIndex sorrendje]
    // =========================================================================

    [Fact]
    public void EvaluateConfiguration_VisualLayers_ExcludesInteriorAndExtrasAndOrdersByZIndexAscending()
    {
        // Arrange – Fordított sorrendben adjuk át a külső rétegeket + belső/extra opciókat
        var request = new ConfigurationRequestDto
        {
            EngineOptionId = ConfigurationService.OptionIds.BaseEngine,
            SelectedOptionIds = new List<int>
            {
                ConfigurationService.OptionIds.SportRim19,        // ZIndex = 30
                ConfigurationService.OptionIds.LeatherInterior,   // Nincs 2D réteg
                ConfigurationService.OptionIds.SportDiffuser,     // ZIndex = 20
                ConfigurationService.OptionIds.LargeNavigation,   // Nincs 2D réteg
                ConfigurationService.OptionIds.FireRedColor,      // ZIndex = 10
                ConfigurationService.OptionIds.HeatedSeats        // Nincs 2D réteg
            }
        };

        // Act
        var result = _service.EvaluateConfiguration(request);

        // Assert – Csak a 3 külső réteg jelenhet meg, szigorúan ZIndex (10 -> 20 -> 30) sorrendben
        Assert.True(result.IsValid);
        Assert.Equal(3, result.VisualLayers.Count);
        Assert.Equal(new[] { 10, 20, 30 }, result.VisualLayers.Select(l => l.ZIndex).ToArray());
        Assert.Equal(
            new[]
            {
                ConfigurationService.OptionIds.FireRedColor,
                ConfigurationService.OptionIds.SportDiffuser,
                ConfigurationService.OptionIds.SportRim19
            },
            result.VisualLayers.Select(l => l.OptionId).ToArray());
    }

    private static ConfigurationsController CreateControllerWithUser(string? userId, IConfigurationService? service = null)
    {
        var controller = new ConfigurationsController(service ?? new ConfigurationService());
        var httpContext = new DefaultHttpContext();

        if (!string.IsNullOrWhiteSpace(userId))
        {
            var identity = new ClaimsIdentity(
                new[] { new Claim(ClaimTypes.NameIdentifier, userId) },
                "TestAuth");
            httpContext.User = new ClaimsPrincipal(identity);
        }

        controller.ControllerContext = new ControllerContext
        {
            HttpContext = httpContext
        };

        return controller;
    }
}
