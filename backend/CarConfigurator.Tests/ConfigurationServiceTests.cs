using CarConfigurator.Api.Dtos;
using CarConfigurator.Api.Services;

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
    // Prémium hangrendszer csak a kötelező Nagy navigációval együtt érvényes
    // =========================================================================

    [Fact]
    public void EvaluateConfiguration_PremiumSoundWithoutLargeNavigation_ReturnsInvalidAndDependencyError()
    {
        // Arrange – Prémium hangrendszer Nagy navigáció nélkül
        var request = new ConfigurationRequestDto
        {
            EngineOptionId = ConfigurationService.OptionIds.BaseEngine,
            SelectedOptionIds = new List<int>
            {
                ConfigurationService.OptionIds.PremiumSoundSystem
            }
        };

        // Act
        var result = _service.EvaluateConfiguration(request);

        // Assert
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
        // Arrange – Prémium hangrendszer (400e Ft) + Nagy navigáció (300e Ft)
        var request = new ConfigurationRequestDto
        {
            EngineOptionId = ConfigurationService.OptionIds.BaseEngine,
            SelectedOptionIds = new List<int>
            {
                ConfigurationService.OptionIds.LargeNavigation,
                ConfigurationService.OptionIds.PremiumSoundSystem
            }
        };

        // Act
        var result = _service.EvaluateConfiguration(request);

        // Assert
        Assert.True(result.IsValid);
        Assert.True(result.CanSave);
        Assert.Empty(result.Errors);
        Assert.Equal(700_000m, result.OptionsPrice);
        Assert.Equal(10_700_000m, result.TotalPrice);
    }

    // =========================================================================
    // 3. Elfogadási feltétel: [Határeset – Kizárás]
    // Alap motor + Sportfutómű, valamint Sport diffúzor + Vonóhorog ütközése
    // =========================================================================

    [Fact]
    public void EvaluateConfiguration_BaseEngineWithSportSuspension_ReturnsInvalidAndDoesNotSilentlyRemoveOption()
    {
        // Arrange – Alap motor + Sportfutómű kizárják egymást; a rendszer nem törölheti némán az opciót!
        var request = new ConfigurationRequestDto
        {
            EngineOptionId = ConfigurationService.OptionIds.BaseEngine,
            SelectedOptionIds = new List<int>
            {
                ConfigurationService.OptionIds.SportSuspension
            }
        };

        // Act
        var result = _service.EvaluateConfiguration(request);

        // Assert
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
        // Arrange – Sport motor (13.5M Ft) mellett a Sportfutómű (350e Ft) engedélyezett
        var request = new ConfigurationRequestDto
        {
            EngineOptionId = ConfigurationService.OptionIds.SportEngine,
            SelectedOptionIds = new List<int>
            {
                ConfigurationService.OptionIds.SportSuspension
            }
        };

        // Act
        var result = _service.EvaluateConfiguration(request);

        // Assert
        Assert.True(result.IsValid);
        Assert.True(result.CanSave);
        Assert.Empty(result.Errors);
        Assert.Equal(13_850_000m, result.TotalPrice);
    }

    [Fact]
    public void EvaluateConfiguration_SportDiffuserWithTowHook_ReturnsInvalidAndExclusionError()
    {
        // Arrange – Sport diffúzor + Vonóhorog kizárják egymást
        var request = new ConfigurationRequestDto
        {
            EngineOptionId = ConfigurationService.OptionIds.BaseEngine,
            SelectedOptionIds = new List<int>
            {
                ConfigurationService.OptionIds.SportDiffuser,
                ConfigurationService.OptionIds.TowHook
            }
        };

        // Act
        var result = _service.EvaluateConfiguration(request);

        // Assert
        Assert.False(result.IsValid);
        Assert.False(result.CanSave);
        var error = Assert.Single(result.Errors);
        Assert.Equal(ConfigurationService.ErrorCodes.ExclusionConflict, error.Code);
        Assert.Contains(ConfigurationService.OptionIds.SportDiffuser, error.AffectedOptionIds);
        Assert.Contains(ConfigurationService.OptionIds.TowHook, error.AffectedOptionIds);
    }

    // =========================================================================
    // 4. Elfogadási feltétel: [Határeset – Csomagkedvezmény (Téli csomag 20%)]
    // Ülésfűtés (150e) + Kormányfűtés (100e) + Fűthető szélvédő (150e) = 400e Ft
    // Mindhárom választásakor 20% (80e Ft) kedvezmény -> 320e Ft;
    // bármelyik kivételekor a kedvezmény megszűnik, a maradó elemek teljes áron számolódnak.
    // =========================================================================

    [Fact]
    public void EvaluateConfiguration_FullWinterPackageSelected_Applies20PercentDiscount()
    {
        // Arrange – Mindhárom Téli csomag elem kiválasztva
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

        // Act
        var result = _service.EvaluateConfiguration(request);

        // Assert
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
    public void EvaluateConfiguration_PartialWinterPackageSelected_RemovesDiscountAndChargesFullPrice(
        int firstOptionId,
        int secondOptionId,
        decimal expectedOptionsPrice)
    {
        // Arrange – Bármelyik 1 elem kivétele a Téli csomagból megszünteti a 20%-os kedvezményt
        var request = new ConfigurationRequestDto
        {
            EngineOptionId = ConfigurationService.OptionIds.BaseEngine,
            SelectedOptionIds = new List<int> { firstOptionId, secondOptionId }
        };

        // Act
        var result = _service.EvaluateConfiguration(request);

        // Assert
        Assert.True(result.IsValid);
        Assert.Equal(expectedOptionsPrice, result.OptionsPrice);
        Assert.Equal(0m, result.DiscountAmount);
        Assert.Empty(result.AppliedDiscounts);
        Assert.Equal(10_000_000m + expectedOptionsPrice, result.TotalPrice);
    }

    // =========================================================================
    // 5. Elfogadási feltétel: [Hibás bemenet – Érvénytelen adatok]
    // Hiányzó motor-ID, nem létező opció-ID (-1), duplikált opciók vagy üres név
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
    public void EvaluateConfiguration_DuplicateOptions_ReturnsInvalidInputError()
    {
        var request = new ConfigurationRequestDto
        {
            EngineOptionId = ConfigurationService.OptionIds.BaseEngine,
            SelectedOptionIds = new List<int>
            {
                ConfigurationService.OptionIds.MetallicColor,
                ConfigurationService.OptionIds.MetallicColor
            }
        };

        var result = _service.EvaluateConfiguration(request);

        Assert.False(result.IsValid);
        Assert.True(result.HasInvalidInput);
        Assert.False(result.CanSave);
        var error = Assert.Single(result.Errors);
        Assert.Equal(ConfigurationService.ErrorCodes.DuplicateOptions, error.Code);
        Assert.Contains(ConfigurationService.OptionIds.MetallicColor, error.AffectedOptionIds);
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
}
